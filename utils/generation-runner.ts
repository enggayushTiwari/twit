import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import {
  buildAuthenticityCriticPrompt,
  buildCandidateGenerationPrompt,
  buildConversationCandidatePrompt,
  buildConversationCriticPrompt,
  buildConversationGenerationSystemPrompt,
  buildGenerationSystemPrompt,
  buildMediaPlanPrompt,
  buildStartupCandidateGenerationPrompt,
  buildStartupCriticPrompt,
  buildStartupGenerationSystemPrompt,
  normalizeMediaPlan,
} from './generation';
import { getErrorMessage } from './errors';
import { parseJsonResponse } from './ai-json';
import { GENERATION_MODEL } from './ai-config';
import {
  chooseConversationArchetype,
  inferPillarLabel,
  type CompanyImageProfile,
  type ConversationOpportunity,
  type DraftKind,
  type NarrativePillar,
  type ProofAsset,
} from './distribution';
import type {
  GenerationCandidate,
  GenerationDraftSet,
  MediaPlan,
  MindModelEntry,
  PostArchetype,
  RankedGenerationResult,
  SurfaceIntent,
  TweetAlternate,
} from './self-model';
import { choosePostPlan } from './post-strategy';
import type { GeneratedTweetMode, StartupProfile, BuildMemoryKind } from './startup';

type RawIdeaRow = {
  id: string;
  content: string;
  embedding: number[] | null;
  type: string | null;
  metadata?: {
    distribution_classification?: string;
    x_eligible?: boolean;
    suggested_pillar?: string;
  } | null;
};

type IdeaMatch = {
  content: string;
};

type BuildMemoryRow = {
  id: string;
  content: string;
  kind: BuildMemoryKind;
  metadata: {
    communication_focus?: string;
    suggested_points?: string[];
    follow_up_answer?: string;
    generalizable_takeaway?: string;
    takeaway_confidence?: number;
    distribution_classification?: string;
    suggested_pillar?: string;
  } | null;
  embedding: number[] | null;
};

type BuildMemoryMatch = {
  content: string;
};

type RecentTweetRow = {
  content: string;
  post_archetype?: PostArchetype | null;
  surface_intent?: SurfaceIntent | null;
  created_at?: string;
};

type UserProfileRow = {
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

type LiveTopicContext = {
  title: string;
  summary: string;
} | null;

type CompanyImageProfileRow = CompanyImageProfile | null;
type NarrativePillarRow = NarrativePillar;
type ProofAssetRow = ProofAsset;
type DistributionSignalRow = {
  outcome_kind: string;
  impressions: number | null;
  profile_visits: number | null;
  follows_gained: number | null;
  notes: string | null;
};
type ConversationOpportunityRow = ConversationOpportunity;

type EventReflectionQueryClient = {
  from: (table: 'event_reflections') => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (count: number) => {
            maybeSingle: () => Promise<{
              data: { headline: string; source_summary: string | null } | null;
            }>;
          };
        };
      };
    };
  };
};

function createClients() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder';

  return {
    ai,
    supabase: createClient(supabaseUrl, supabaseKey),
  };
}

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

function buildBuildContext(seedEntry: BuildMemoryRow, relatedEntries: BuildMemoryMatch[] | null) {
  const blocks = new Set<string>();
  const seedPoints = seedEntry.metadata?.suggested_points?.join('; ') || '';
  const seedFocus = seedEntry.metadata?.communication_focus || '';
  const seedFollowUp = seedEntry.metadata?.follow_up_answer || '';

  blocks.add(
    [
      `Build memory seed (${seedEntry.kind}): ${seedEntry.content}`,
      seedFocus ? `Communication focus: ${seedFocus}` : '',
      seedPoints ? `Suggested points: ${seedPoints}` : '',
      seedFollowUp ? `Founder clarification: ${seedFollowUp}` : '',
      seedEntry.metadata?.generalizable_takeaway
        ? `Generalizable takeaway: ${seedEntry.metadata.generalizable_takeaway}`
        : '',
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
    .map((block, index) => `Build Context ${index + 1}:\n${block}`)
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

function summarizeDistributionSignals(rows: DistributionSignalRow[] | null | undefined) {
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => {
    const metrics = [
      typeof row.impressions === 'number' ? `${row.impressions} impressions` : '',
      typeof row.profile_visits === 'number' ? `${row.profile_visits} profile visits` : '',
      typeof row.follows_gained === 'number' ? `${row.follows_gained} follows` : '',
    ]
      .filter(Boolean)
      .join(', ');

    return [row.outcome_kind.replace(/_/g, ' '), metrics, row.notes || '']
      .filter(Boolean)
      .join(' | ');
  });
}

async function getDistributionContext(
  supabase: unknown
): Promise<{
  companyImageProfile: CompanyImageProfileRow;
  narrativePillars: NarrativePillarRow[];
  proofAssets: ProofAssetRow[];
  distributionSignals: string[];
}> {
  const client = supabase as ReturnType<typeof createClient>;
  const [companyProfileRow, pillarRows, proofRows, outcomeRows] = await Promise.all([
    client
      .from('company_image_profiles')
      .select(
        'id, company_name, known_for, who_it_helps, painful_problem, proof_points, objection_patterns, positioning_statements, bio_direction, header_concept, pinned_post_strategy, link_intent, updated_at'
      )
      .limit(1)
      .maybeSingle(),
    client
      .from('narrative_pillars')
      .select('id, label, description, priority, active, created_at')
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(8),
    client
      .from('proof_assets')
      .select('id, kind, title, content, asset_url, proof_strength, created_at')
      .order('proof_strength', { ascending: false })
      .limit(8),
    client
      .from('distribution_outcomes')
      .select('outcome_kind, impressions, profile_visits, follows_gained, notes')
      .order('created_at', { ascending: false })
      .limit(6),
  ]);

  return {
    companyImageProfile: (companyProfileRow.data || null) as CompanyImageProfileRow,
    narrativePillars: (pillarRows.data || []) as NarrativePillarRow[],
    proofAssets: (proofRows.data || []) as ProofAssetRow[],
    distributionSignals: summarizeDistributionSignals(
      (outcomeRows.data || []) as DistributionSignalRow[]
    ),
  };
}

async function getLatestLiveTopicContext(
  supabase: EventReflectionQueryClient,
  mode: GeneratedTweetMode
) {
  const { data } = await supabase
    .from('event_reflections')
    .select('headline, source_summary')
    .in('status', ['captured', 'reflected'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const latestEvent = data as { headline: string; source_summary: string | null } | null;

  if (!latestEvent?.headline) {
    return null;
  }

  if (mode === 'build' && !/startup|product|customer|feature|launch|funding|ship|release/i.test(`${latestEvent.headline} ${latestEvent.source_summary || ''}`)) {
    return null;
  }

  return {
    title: latestEvent.headline,
    summary: latestEvent.source_summary || '',
  } satisfies LiveTopicContext;
}

async function planMediaForDraft(params: {
  ai: GoogleGenAI;
  draft: string;
  archetype: PostArchetype;
  surfaceIntent: SurfaceIntent;
}) {
  const response = await params.ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: buildMediaPlanPrompt({
      selectedDraft: params.draft,
      targetArchetype: params.archetype,
      surfaceIntent: params.surfaceIntent,
    }),
    config: {
      systemInstruction:
        'You are a strict media planner. Return JSON only and prefer none when media would feel forced.',
      temperature: 0.2,
    },
  });

  return normalizeMediaPlan(
    parseJsonResponse<MediaPlan>(response.text || '', 'Media planner returned invalid structured output')
  );
}

export async function generateGeneralTweetDraft() {
  try {
    const { ai, supabase } = createClients();

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
      .select('id, content, embedding, type, metadata')
      .neq('type', 'project_log');

    const allValidIdeas = ((allIdeas || []) as RawIdeaRow[])
      .map((idea) => ({ ...idea, embedding: ensureArray(idea.embedding) }))
      .filter((idea) => idea.embedding.length > 0);

    const validIdeas = allValidIdeas.filter((idea) => {
      const classification = idea.metadata?.distribution_classification;
      return idea.metadata?.x_eligible !== false && classification !== 'private_thought';
    });

    const seedPool = validIdeas.length > 0 ? validIdeas : allValidIdeas;

    if (seedPool.length === 0) {
      throw new Error('Ideas exist, but none have valid embeddings yet.');
    }

    const preferredSeedPool = seedPool.filter((idea) =>
      ['company_narrative', 'customer_pain', 'proof', 'trend_reaction', 'reply_seed'].includes(
        idea.metadata?.distribution_classification || ''
      )
    );
    const seedIdea =
      (preferredSeedPool.length > 0 ? preferredSeedPool : seedPool)[
        Math.floor(Math.random() * (preferredSeedPool.length > 0 ? preferredSeedPool.length : seedPool.length))
      ];

    const { data: relatedIdeas, error: matchError } = await supabase.rpc('match_ideas', {
      query_embedding: seedIdea.embedding,
      match_threshold: 0.1,
      match_count: 4,
    });

    if (matchError) {
      throw new Error('Failed to find related ideas via similarity search.');
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

    const distributionContext = await getDistributionContext(supabase);

    const { data: recentTweets } = await supabase
      .from('generated_tweets')
      .select('content, post_archetype, surface_intent, created_at')
      .eq('generation_mode', 'general')
      .in('status', ['APPROVED', 'OPENED_IN_X', 'PUBLISHED', 'PENDING'])
      .order('created_at', { ascending: false })
      .limit(20);

    const liveTopicContext = await getLatestLiveTopicContext(
      supabase as unknown as EventReflectionQueryClient,
      'general'
    );
    const postPlan = choosePostPlan({
      mode: 'general',
      recentPosts: ((recentTweets || []) as RecentTweetRow[]) || [],
      hasLiveTopic: Boolean(liveTopicContext),
      now: new Date(),
    });

    const contextIdeas = buildContextIdeas(seedIdea.content, (relatedIdeas || []) as IdeaMatch[]);
    const systemPrompt = buildGenerationSystemPrompt({
      profile: (profile || null) as UserProfileRow,
      creatorPersona: (creatorPersona || null) as CreatorPersonaRow,
      sourceType: seedIdea.type,
      contextIdeas,
      pastTweets:
        ((recentTweets || []) as RecentTweetRow[]).map((tweet) => tweet.content).join('\n') ||
        'None',
      confirmedEntries: ((worldviewRows || []) as MindModelEntry[]) || [],
      currentObsessions: (obsessionRows || []).map((row) => row.statement).filter(Boolean),
      recentEventPovs: (eventPovRows || []).map((row) => row.statement).filter(Boolean),
      companyImageProfile: distributionContext.companyImageProfile,
      narrativePillars: distributionContext.narrativePillars,
      proofAssets: distributionContext.proofAssets,
      distributionSignals: distributionContext.distributionSignals,
    });

    const generationResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildCandidateGenerationPrompt({
        seedIdea: seedIdea.content,
        targetArchetype: postPlan.archetype,
        surfaceIntent: postPlan.surfaceIntent,
        liveTopicTitle: liveTopicContext?.title || null,
      }),
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
      throw new Error('Generation model returned no usable tweet candidates.');
    }

    const criticResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildAuthenticityCriticPrompt(
        JSON.stringify(draftSet, null, 2),
        postPlan.archetype,
        postPlan.surfaceIntent
      ),
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
      draftSet.candidates[rankedResult.selected_index] ||
      rankedCandidates[0] ||
      draftSet.candidates[0];

    if (!selectedCandidate) {
      throw new Error('No selected draft could be determined.');
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
    const mediaPlan = await planMediaForDraft({
      ai,
      draft: selectedCandidate.draft,
      archetype: postPlan.archetype,
      surfaceIntent: postPlan.surfaceIntent,
    });

    const { data: insertedTweet, error: insertError } = await supabase
      .from('generated_tweets')
      .insert([
        {
          content: selectedCandidate.draft,
          status: 'PENDING',
          generation_mode: 'general',
          draft_kind: 'original_post',
          theses: draftSet.theses,
          alternates,
          rationale: rationaleParts.join('\n\n'),
          post_archetype: postPlan.archetype,
          surface_intent: postPlan.surfaceIntent,
          media_plan: mediaPlan,
          source_memory_scope: 'general',
          pillar_label: inferPillarLabel({
            classification: (seedIdea.metadata?.distribution_classification as
              | Parameters<typeof inferPillarLabel>[0]['classification']
              | undefined) || null,
            content: seedIdea.content,
            availablePillars: distributionContext.narrativePillars,
          }),
          source_conversation_id: null,
        },
      ])
      .select('id, content, status, generation_mode, draft_kind, pillar_label, source_conversation_id, theses, alternates, rationale, created_at, post_archetype, surface_intent, media_plan, source_memory_scope')
      .single();

    if (insertError || !insertedTweet) {
      throw new Error('Failed to save the generated tweet.');
    }

    return { success: true as const, tweet: insertedTweet };
  } catch (error) {
    return {
      success: false as const,
      error: getErrorMessage(error, 'An unexpected generation error occurred.'),
    };
  }
}

export async function generateBuildTweetDraft() {
  try {
    const { ai, supabase } = createClients();

    const { data: startupProfile } = await supabase
      .from('startup_profiles')
      .select(
        'id, startup_name, one_liner, target_customer, painful_problem, transformation, positioning, proof_points, objections, language_guardrails, updated_at'
      )
      .limit(1)
      .maybeSingle();

    const { data: allBuildMemory } = await supabase
      .from('build_memory_entries')
      .select('id, content, kind, metadata, embedding');

    const validEntries = ((allBuildMemory || []) as BuildMemoryRow[])
      .map((entry) => ({ ...entry, embedding: ensureArray(entry.embedding) }))
      .filter((entry) => entry.embedding.length > 0);

    if (validEntries.length === 0) {
      throw new Error('Save some build memory first so the build-in-public generator has context.');
    }

    const seedEntry = validEntries[Math.floor(Math.random() * validEntries.length)];

    const { data: relatedEntries, error: matchError } = await supabase.rpc('match_build_memory', {
      query_embedding: seedEntry.embedding,
      match_threshold: 0.1,
      match_count: 4,
    });

    if (matchError) {
      throw new Error('Failed to retrieve related build memory.');
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

    const { data: buildReflectionRows } = await supabase
      .from('build_reflection_turns')
      .select('prompt, answer')
      .neq('answer', '')
      .neq('answer', '[skipped]')
      .order('created_at', { ascending: false })
      .limit(8);

    const distributionContext = await getDistributionContext(supabase);

    const { data: recentTweets } = await supabase
      .from('generated_tweets')
      .select('content, post_archetype, surface_intent, created_at')
      .in('generation_mode', ['build', 'startup'])
      .in('status', ['APPROVED', 'OPENED_IN_X', 'PUBLISHED', 'PENDING'])
      .order('created_at', { ascending: false })
      .limit(16);

    const liveTopicContext = await getLatestLiveTopicContext(
      supabase as unknown as EventReflectionQueryClient,
      'build'
    );
    const postPlan = choosePostPlan({
      mode: 'build',
      recentPosts: ((recentTweets || []) as RecentTweetRow[]) || [],
      hasLiveTopic: Boolean(liveTopicContext),
      now: new Date(),
    });

    const startupContext = buildBuildContext(
      seedEntry,
      (relatedEntries || []) as BuildMemoryMatch[]
    );
    const systemPrompt = buildStartupGenerationSystemPrompt({
      startupProfile: (startupProfile || null) as StartupProfile | null,
      startupContext,
      sharedMindModel: ((worldviewRows || []) as MindModelEntry[]) || [],
      startupReflections: (buildReflectionRows || []).map(
        (row) => `Prompt: ${row.prompt}\nAnswer: ${row.answer}`
      ),
      recentStartupTweets:
        ((recentTweets || []) as RecentTweetRow[]).map((tweet) => tweet.content).join('\n') ||
        'None',
      companyImageProfile: distributionContext.companyImageProfile,
      narrativePillars: distributionContext.narrativePillars,
      proofAssets: distributionContext.proofAssets,
      distributionSignals: distributionContext.distributionSignals,
    });

    const generationResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildStartupCandidateGenerationPrompt({
        seedIdea: seedEntry.content,
        targetArchetype: postPlan.archetype,
        surfaceIntent: postPlan.surfaceIntent,
        liveTopicTitle: liveTopicContext?.title || null,
      }),
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
      throw new Error('Startup generation returned no usable tweet candidates.');
    }

    const criticResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildStartupCriticPrompt(
        JSON.stringify(draftSet, null, 2),
        postPlan.archetype,
        postPlan.surfaceIntent
      ),
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
      throw new Error('No startup draft could be selected.');
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
    const mediaPlan = await planMediaForDraft({
      ai,
      draft: selectedCandidate.draft,
      archetype: postPlan.archetype,
      surfaceIntent: postPlan.surfaceIntent,
    });

    const { data: insertedTweet, error: insertError } = await supabase
      .from('generated_tweets')
      .insert([
        {
          content: selectedCandidate.draft,
          status: 'PENDING',
          generation_mode: 'build',
          draft_kind: 'original_post',
          theses: draftSet.theses,
          alternates,
          rationale: rationaleParts.join('\n\n'),
          post_archetype: postPlan.archetype,
          surface_intent: postPlan.surfaceIntent,
          media_plan: mediaPlan,
          source_memory_scope: 'build',
          pillar_label: inferPillarLabel({
            classification: (seedEntry.metadata?.distribution_classification as
              | Parameters<typeof inferPillarLabel>[0]['classification']
              | undefined) || null,
            content: seedEntry.content,
            availablePillars: distributionContext.narrativePillars,
          }),
          source_conversation_id: null,
        },
      ])
      .select('id, content, status, generation_mode, draft_kind, pillar_label, source_conversation_id, theses, alternates, rationale, created_at, post_archetype, surface_intent, media_plan, source_memory_scope')
      .single();

    if (insertError || !insertedTweet) {
      throw new Error('Failed to save the build draft.');
    }

    return { success: true as const, tweet: insertedTweet };
  } catch (error) {
    return {
      success: false as const,
      error: getErrorMessage(error, 'An unexpected build generation error occurred.'),
    };
  }
}

export async function generateConversationDraft(params: {
  draftKind: DraftKind;
  conversationOpportunityId: string;
}) {
  try {
    const { ai, supabase } = createClients();

    const [{ data: conversation }, { data: worldviewRows }, { data: recentTweets }, distributionContext, { data: buildRows }] =
      await Promise.all([
        supabase
          .from('conversation_opportunities')
          .select(
            'id, source_type, source_url, author_handle, author_name, content, topic_tags, why_it_matters, recommended_action, status, raw_input, created_at'
          )
          .eq('id', params.conversationOpportunityId)
          .maybeSingle(),
        supabase
          .from('mind_model_entries')
          .select(
            'id, kind, statement, status, confidence, priority, source_type, source_ref_id, tags, evidence_summary, created_at, updated_at'
          )
          .eq('status', 'confirmed')
          .in('kind', ['belief', 'lens', 'taste_like', 'taste_avoid', 'voice_rule'])
          .order('priority', { ascending: false })
          .limit(18),
        supabase
          .from('generated_tweets')
          .select('content, post_archetype, surface_intent, created_at')
          .eq('generation_mode', 'build')
          .in('draft_kind', ['reply', 'quote_post'])
          .order('created_at', { ascending: false })
          .limit(12),
        getDistributionContext(supabase),
        supabase
          .from('build_memory_entries')
          .select('kind, content')
          .order('created_at', { ascending: false })
          .limit(6),
      ]);

    const conversationRow = (conversation || null) as ConversationOpportunityRow | null;
    if (!conversationRow) {
      throw new Error('Conversation opportunity not found.');
    }

    const targetArchetype = chooseConversationArchetype({
      draftKind: params.draftKind,
      recommendedAction: conversationRow.recommended_action,
      content: conversationRow.content,
      recentArchetypes: ((recentTweets || []) as RecentTweetRow[]).map(
        (tweet) => tweet.post_archetype
      ),
    });
    const surfaceIntent: SurfaceIntent =
      params.draftKind === 'reply'
        ? 'conversation_starter'
        : conversationRow.recommended_action === 'quote'
        ? 'news_reaction'
        : 'feed_post';

    const buildContext =
      ((buildRows || []) as Array<{ kind: string; content: string }>)
        .map((row) => `[${row.kind}] ${row.content}`)
        .join('\n') || 'None';
    const conversationContext = [
      conversationRow.author_name || conversationRow.author_handle
        ? `Author: ${conversationRow.author_name || ''} ${
            conversationRow.author_handle ? `(@${conversationRow.author_handle})` : ''
          }`.trim()
        : '',
      conversationRow.source_url ? `Source URL: ${conversationRow.source_url}` : '',
      `Recommended action: ${conversationRow.recommended_action}`,
      conversationRow.topic_tags.length > 0
        ? `Topic tags: ${conversationRow.topic_tags.join(', ')}`
        : '',
      conversationRow.why_it_matters ? `Why it matters: ${conversationRow.why_it_matters}` : '',
      `Conversation text:\n${conversationRow.content}`,
    ]
      .filter(Boolean)
      .join('\n');

    const systemPrompt = buildConversationGenerationSystemPrompt({
      draftKind: params.draftKind,
      conversationContext,
      companyImageProfile: distributionContext.companyImageProfile,
      narrativePillars: distributionContext.narrativePillars,
      proofAssets: distributionContext.proofAssets,
      sharedMindModel: ((worldviewRows || []) as MindModelEntry[]) || [],
      buildContext,
      recentDistributionDrafts:
        ((recentTweets || []) as RecentTweetRow[]).map((tweet) => tweet.content).join('\n') ||
        'None',
      distributionSignals: distributionContext.distributionSignals,
    });

    const generationResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildConversationCandidatePrompt({
        draftKind: params.draftKind,
        targetArchetype,
        surfaceIntent,
        conversationText: conversationContext,
      }),
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
      },
    });

    const draftSet = normalizeDraftSet(
      parseJsonResponse<GenerationDraftSet>(
        generationResponse.text || '',
        'Conversation generation returned invalid structured output'
      )
    );

    if (draftSet.candidates.length === 0) {
      throw new Error('Conversation generation returned no usable candidates.');
    }

    const criticResponse = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: buildConversationCriticPrompt({
        candidatesJson: JSON.stringify(draftSet, null, 2),
        draftKind: params.draftKind,
        targetArchetype,
        surfaceIntent,
      }),
      config: {
        systemInstruction:
          'You are a strict X distribution evaluator. Return JSON only and never add prose outside the schema.',
        temperature: 0.2,
      },
    });

    const rankedResult = normalizeRankedResult(
      parseJsonResponse<RankedGenerationResult>(
        criticResponse.text || '',
        'Conversation critic returned invalid structured output'
      )
    );

    const rankedCandidates = buildRankedCandidates(draftSet.candidates, rankedResult);
    const selectedCandidate =
      draftSet.candidates[rankedResult.selected_index] ||
      rankedCandidates[0] ||
      draftSet.candidates[0];

    if (!selectedCandidate) {
      throw new Error('No conversation draft could be selected.');
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
    const mediaPlan = await planMediaForDraft({
      ai,
      draft: selectedCandidate.draft,
      archetype: targetArchetype,
      surfaceIntent,
    });

    const { data: insertedTweet, error: insertError } = await supabase
      .from('generated_tweets')
      .insert([
        {
          content: selectedCandidate.draft,
          status: 'PENDING',
          generation_mode: 'build',
          draft_kind: params.draftKind,
          pillar_label: inferPillarLabel({
            content: conversationRow.content,
            availablePillars: distributionContext.narrativePillars,
          }),
          source_conversation_id: conversationRow.id,
          theses: draftSet.theses,
          alternates,
          rationale: [selectedCandidate.why_it_fits, selectedRanking?.critiqueReason || '']
            .filter(Boolean)
            .join('\n\n'),
          post_archetype: targetArchetype,
          surface_intent: surfaceIntent,
          media_plan: mediaPlan,
          source_memory_scope: 'mixed',
        },
      ])
      .select('id, content, status, generation_mode, draft_kind, pillar_label, source_conversation_id, theses, alternates, rationale, created_at, post_archetype, surface_intent, media_plan, source_memory_scope')
      .single();

    if (insertError || !insertedTweet) {
      throw new Error('Failed to save the conversation draft.');
    }

    return { success: true as const, tweet: insertedTweet };
  } catch (error) {
    return {
      success: false as const,
      error: getErrorMessage(error, 'An unexpected conversation generation error occurred.'),
    };
  }
}

export async function generateStartupTweetDraft() {
  return generateBuildTweetDraft();
}
