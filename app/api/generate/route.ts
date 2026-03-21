import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import {
  buildAuthenticityCriticPrompt,
  buildCandidateGenerationPrompt,
  buildGenerationSystemPrompt,
} from '@/utils/generation';
import { getErrorMessage } from '@/utils/errors';
import { parseJsonResponse } from '@/utils/ai-json';
import { GENERATION_MODEL } from '@/utils/ai-config';
import type {
  GenerationCandidate,
  GenerationDraftSet,
  MindModelEntry,
  RankedGenerationResult,
  TweetAlternate,
} from '@/utils/self-model';

export const dynamic = 'force-dynamic';

type RawIdeaRow = {
  id: string;
  content: string;
  embedding: number[] | null;
  type: string | null;
};

type IdeaMatch = {
  content: string;
};

type TweetContentRow = {
  content: string;
};

type ProfileRow = {
  desired_perception?: string | null;
  target_audience?: string | null;
  tone_guardrails?: string | null;
} | null;

type CreatorPersonaRow = {
  handle: string;
  ai_voice_profile: string;
} | null;

type RankedCandidate = GenerationCandidate & {
  draftIndex: number;
  score: number;
  critiqueReason: string;
};

function normalizeDraftSet(rawDraftSet: GenerationDraftSet): GenerationDraftSet {
  return {
    theses: Array.isArray(rawDraftSet.theses)
      ? rawDraftSet.theses.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 5)
      : [],
    candidates: Array.isArray(rawDraftSet.candidates)
      ? rawDraftSet.candidates
          .map((candidate) => ({
            thesis: String(candidate?.thesis || '').trim(),
            draft: String(candidate?.draft || '').trim(),
            why_it_fits: String(candidate?.why_it_fits || '').trim(),
          }))
          .filter((candidate) => candidate.thesis && candidate.draft && candidate.why_it_fits)
          .slice(0, 5)
      : [],
  };
}

function normalizeRankedResult(rawRankedResult: RankedGenerationResult): RankedGenerationResult {
  return {
    selected_index:
      typeof rawRankedResult.selected_index === 'number' ? rawRankedResult.selected_index : 0,
    ranked: Array.isArray(rawRankedResult.ranked)
      ? rawRankedResult.ranked
          .map((item) => ({
            draft_index:
              typeof item?.draft_index === 'number' ? item.draft_index : Number(item?.draft_index || 0),
            score: typeof item?.score === 'number' ? item.score : Number(item?.score || 0),
            reason: String(item?.reason || '').trim(),
          }))
          .filter((item) => Number.isFinite(item.draft_index))
      : [],
  };
}

function buildContextIdeas(seedIdea: string, relatedIdeas: IdeaMatch[] | null) {
  const uniqueIdeas = new Set<string>();
  uniqueIdeas.add(seedIdea.trim());

  for (const idea of relatedIdeas || []) {
    const content = idea.content?.trim();
    if (content) {
      uniqueIdeas.add(content);
    }
  }

  return Array.from(uniqueIdeas)
    .map((idea, index) => `Idea ${index + 1}: ${idea}`)
    .join('\n\n');
}

function buildRankedCandidates(
  candidates: GenerationCandidate[],
  rankedResult: RankedGenerationResult
): RankedCandidate[] {
  const rankedLookup = new Map<number, { score: number; reason: string }>();

  for (const item of rankedResult.ranked) {
    rankedLookup.set(item.draft_index, {
      score: Number.isFinite(item.score) ? item.score : 0,
      reason: item.reason || '',
    });
  }

  return candidates
    .map((candidate, index) => ({
      ...candidate,
      draftIndex: index,
      score: rankedLookup.get(index)?.score ?? 0,
      critiqueReason: rankedLookup.get(index)?.reason ?? '',
    }))
    .sort((left, right) => right.score - left.score);
}

export async function POST() {
  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'placeholder';
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: profile } = await supabase
      .from('user_profile')
      .select('desired_perception, target_audience, tone_guardrails')
      .limit(1)
      .maybeSingle();

    const { data: creatorPersona } = await supabase
      .from('creator_personas')
      .select('handle, ai_voice_profile')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: allIdeas } = await supabase
      .from('raw_ideas')
      .select('id, content, embedding, type');

    function ensureArray(val: unknown): number[] {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val.replace('[', '').replace(']', '').split(',').map(Number);
        }
      }
      return [];
    }

    const validIdeas = (allIdeas as RawIdeaRow[])
      .map(idea => ({ ...idea, embedding: ensureArray(idea.embedding) }))
      .filter(idea => idea.embedding.length > 0);

    if (validIdeas.length === 0) {
      return NextResponse.json(
        { error: 'Ideas exist, but none have valid embeddings yet.' },
        { status: 500 }
      );
    }

    const seedIdea = validIdeas[Math.floor(Math.random() * validIdeas.length)];

    const { data: relatedIdeas, error: matchError } = await supabase.rpc('match_ideas', {
      query_embedding: seedIdea.embedding,
      match_threshold: 0.1,
      match_count: 4,
    });

    if (matchError) {
      return NextResponse.json(
        { error: 'Failed to find related ideas via similarity search.' },
        { status: 500 }
      );
    }

    const { data: worldviewRows } = await supabase
      .from('mind_model_entries')
      .select(
        'id, kind, statement, status, confidence, priority, source_type, source_ref_id, tags, evidence_summary, created_at, updated_at'
      )
      .eq('status', 'confirmed')
      .in('kind', ['belief', 'lens', 'taste_like', 'taste_avoid', 'voice_rule'])
      .order('priority', { ascending: false })
      .limit(18);

    const { data: obsessionRows } = await supabase
      .from('mind_model_entries')
      .select('statement')
      .eq('status', 'confirmed')
      .eq('kind', 'current_obsession')
      .order('updated_at', { ascending: false })
      .limit(6);

    const recentThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: eventPovRows } = await supabase
      .from('mind_model_entries')
      .select('statement')
      .eq('kind', 'event_pov')
      .in('status', ['confirmed', 'suggested'])
      .gte('updated_at', recentThreshold)
      .order('updated_at', { ascending: false })
      .limit(6);

    const { data: recentTweets } = await supabase
      .from('generated_tweets')
      .select('content')
      .in('status', ['APPROVED', 'OPENED_IN_X', 'PUBLISHED', 'PENDING'])
      .order('created_at', { ascending: false })
      .limit(20);

    const contextIdeas = buildContextIdeas(seedIdea.content, (relatedIdeas || []) as IdeaMatch[]);
    const systemPrompt = buildGenerationSystemPrompt({
      profile: (profile || null) as ProfileRow,
      creatorPersona: (creatorPersona || null) as CreatorPersonaRow,
      sourceType: seedIdea.type,
      contextIdeas,
      pastTweets:
        ((recentTweets || []) as TweetContentRow[]).map((tweet) => tweet.content).join('\n') ||
        'None',
      confirmedEntries: ((worldviewRows || []) as MindModelEntry[]) || [],
      currentObsessions: (obsessionRows || []).map((row) => row.statement).filter(Boolean),
      recentEventPovs: (eventPovRows || []).map((row) => row.statement).filter(Boolean),
    });

    const generationResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildCandidateGenerationPrompt({ seedIdea: seedIdea.content }),
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.85,
      },
    });

    const draftSet = normalizeDraftSet(
      parseJsonResponse<GenerationDraftSet>(
        generationResponse.text || '',
        'Generation model returned invalid structured output'
      )
    );

    if (draftSet.candidates.length === 0) {
      return NextResponse.json(
        { error: 'Generation model returned no usable tweet candidates.' },
        { status: 500 }
      );
    }

    const criticResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildAuthenticityCriticPrompt(JSON.stringify(draftSet, null, 2)),
      config: {
        systemInstruction:
          'You are a strict evaluator of authenticity. Return JSON only and never add prose outside the schema.',
        temperature: 0.2,
      },
    });

    const rankedResult = normalizeRankedResult(
      parseJsonResponse<RankedGenerationResult>(
        criticResponse.text || '',
        'Authenticity critic returned invalid structured output'
      )
    );

    const rankedCandidates = buildRankedCandidates(draftSet.candidates, rankedResult);
    const selectedCandidate =
      draftSet.candidates[rankedResult.selected_index] || rankedCandidates[0] || draftSet.candidates[0];

    if (!selectedCandidate) {
      return NextResponse.json({ error: 'No selected draft could be determined.' }, { status: 500 });
    }

    const selectedRanking =
      rankedCandidates.find((candidate) => candidate.draft === selectedCandidate.draft) || null;
    const alternates: TweetAlternate[] = rankedCandidates
      .filter((candidate) => candidate.draft !== selectedCandidate.draft)
      .slice(0, 2)
      .map((candidate) => ({
        draft: candidate.draft,
        thesis: candidate.thesis,
        why_it_fits: candidate.why_it_fits,
        score: candidate.score,
      }));

    const rationaleParts = [
      selectedCandidate.why_it_fits,
      selectedRanking?.critiqueReason || '',
    ].filter(Boolean);

    const { data: insertedTweet, error: insertError } = await supabase
      .from('generated_tweets')
      .insert([
        {
          content: selectedCandidate.draft,
          status: 'PENDING',
          theses: draftSet.theses,
          alternates,
          rationale: rationaleParts.join('\n\n'),
        },
      ])
      .select('id, content, status, theses, alternates, rationale, created_at')
      .single();

    if (insertError || !insertedTweet) {
      return NextResponse.json({ error: 'Failed to save the generated tweet.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tweet: insertedTweet,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err, 'An unexpected generation error occurred.') },
      { status: 500 }
    );
  }
}
