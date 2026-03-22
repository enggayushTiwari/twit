import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import {
  buildStartupCandidateGenerationPrompt,
  buildStartupCriticPrompt,
  buildStartupGenerationSystemPrompt,
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
import type { StartupProfile } from '@/utils/startup';

export const dynamic = 'force-dynamic';

type StartupMemoryRow = {
  id: string;
  content: string;
  kind: string;
  metadata: {
    communication_focus?: string;
    suggested_points?: string[];
    follow_up_answer?: string;
  } | null;
  embedding: number[] | null;
};

type StartupMemoryMatch = {
  content: string;
};

type TweetContentRow = {
  content: string;
};

type RankedCandidate = GenerationCandidate & {
  draftIndex: number;
  score: number;
  critiqueReason: string;
};

function ensureArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map(Number).filter(Number.isFinite);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
    } catch {
      return value
        .replace('[', '')
        .replace(']', '')
        .split(',')
        .map(Number)
        .filter(Number.isFinite);
    }
  }

  return [];
}

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
              typeof item?.draft_index === 'number'
                ? item.draft_index
                : Number(item?.draft_index || 0),
            score: typeof item?.score === 'number' ? item.score : Number(item?.score || 0),
            reason: String(item?.reason || '').trim(),
          }))
          .filter((item) => Number.isFinite(item.draft_index))
      : [],
  };
}

function buildStartupContext(seedEntry: StartupMemoryRow, relatedEntries: StartupMemoryMatch[] | null) {
  const blocks = new Set<string>();
  const seedPoints = seedEntry.metadata?.suggested_points?.join('; ') || '';
  const seedFocus = seedEntry.metadata?.communication_focus || '';
  const seedFollowUp = seedEntry.metadata?.follow_up_answer || '';

  blocks.add(
    [
      `Startup memory seed (${seedEntry.kind}): ${seedEntry.content}`,
      seedFocus ? `Communication focus: ${seedFocus}` : '',
      seedPoints ? `Suggested points: ${seedPoints}` : '',
      seedFollowUp ? `Founder clarification: ${seedFollowUp}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  );

  for (const entry of relatedEntries || []) {
    const content = entry.content?.trim();
    if (content) {
      blocks.add(content);
    }
  }

  return Array.from(blocks)
    .map((block, index) => `Startup Context ${index + 1}:\n${block}`)
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

    const { data: startupProfile } = await supabase
      .from('startup_profiles')
      .select(
        'id, startup_name, one_liner, target_customer, painful_problem, transformation, positioning, proof_points, objections, language_guardrails, updated_at'
      )
      .limit(1)
      .maybeSingle();

    const { data: allStartupMemory } = await supabase
      .from('startup_memory_entries')
      .select('id, content, kind, metadata, embedding');

    const validEntries = ((allStartupMemory || []) as StartupMemoryRow[])
      .map((entry) => ({ ...entry, embedding: ensureArray(entry.embedding) }))
      .filter((entry) => entry.embedding.length > 0);

    if (validEntries.length === 0) {
      return NextResponse.json(
        { error: 'Save some startup memory first so the startup generator has context.' },
        { status: 400 }
      );
    }

    const seedEntry = validEntries[Math.floor(Math.random() * validEntries.length)];

    const { data: relatedEntries, error: matchError } = await supabase.rpc('match_startup_memory', {
      query_embedding: seedEntry.embedding,
      match_threshold: 0.1,
      match_count: 4,
    });

    if (matchError) {
      return NextResponse.json(
        { error: 'Failed to retrieve related startup memory.' },
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

    const { data: startupReflectionRows } = await supabase
      .from('startup_reflection_turns')
      .select('prompt, answer')
      .neq('answer', '')
      .neq('answer', '[skipped]')
      .order('created_at', { ascending: false })
      .limit(8);

    const { data: recentTweets } = await supabase
      .from('generated_tweets')
      .select('content')
      .eq('generation_mode', 'startup')
      .in('status', ['APPROVED', 'OPENED_IN_X', 'PUBLISHED', 'PENDING'])
      .order('created_at', { ascending: false })
      .limit(16);

    const startupContext = buildStartupContext(seedEntry, (relatedEntries || []) as StartupMemoryMatch[]);
    const systemPrompt = buildStartupGenerationSystemPrompt({
      startupProfile: (startupProfile || null) as StartupProfile | null,
      startupContext,
      sharedMindModel: ((worldviewRows || []) as MindModelEntry[]) || [],
      startupReflections: (startupReflectionRows || []).map(
        (row) => `Prompt: ${row.prompt}\nAnswer: ${row.answer}`
      ),
      recentStartupTweets:
        ((recentTweets || []) as TweetContentRow[]).map((tweet) => tweet.content).join('\n') ||
        'None',
    });

    const generationResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildStartupCandidateGenerationPrompt({ seedIdea: seedEntry.content }),
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
      },
    });

    const draftSet = normalizeDraftSet(
      parseJsonResponse<GenerationDraftSet>(
        generationResponse.text || '',
        'Startup generation model returned invalid structured output'
      )
    );

    if (draftSet.candidates.length === 0) {
      return NextResponse.json(
        { error: 'Startup generation returned no usable tweet candidates.' },
        { status: 500 }
      );
    }

    const criticResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildStartupCriticPrompt(JSON.stringify(draftSet, null, 2)),
      config: {
        systemInstruction:
          'You are a strict startup communication evaluator. Return JSON only and never add prose outside the schema.',
        temperature: 0.2,
      },
    });

    const rankedResult = normalizeRankedResult(
      parseJsonResponse<RankedGenerationResult>(
        criticResponse.text || '',
        'Startup critic returned invalid structured output'
      )
    );

    const rankedCandidates = buildRankedCandidates(draftSet.candidates, rankedResult);
    const selectedCandidate =
      draftSet.candidates[rankedResult.selected_index] ||
      rankedCandidates[0] ||
      draftSet.candidates[0];

    if (!selectedCandidate) {
      return NextResponse.json(
        { error: 'No startup draft could be selected.' },
        { status: 500 }
      );
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

    const rationaleParts = [selectedCandidate.why_it_fits, selectedRanking?.critiqueReason || ''].filter(
      Boolean
    );

    const { data: insertedTweet, error: insertError } = await supabase
      .from('generated_tweets')
      .insert([
        {
          content: selectedCandidate.draft,
          status: 'PENDING',
          generation_mode: 'startup',
          theses: draftSet.theses,
          alternates,
          rationale: rationaleParts.join('\n\n'),
        },
      ])
      .select('id, content, status, generation_mode, theses, alternates, rationale, created_at')
      .single();

    if (insertError || !insertedTweet) {
      return NextResponse.json(
        { error: 'Failed to save the startup draft.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      tweet: insertedTweet,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(err, 'An unexpected startup generation error occurred.') },
      { status: 500 }
    );
  }
}
