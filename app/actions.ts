'use server';

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, GENERATION_MODEL } from '../utils/ai-config';
import { parseJsonResponse } from '../utils/ai-json';
import { getErrorMessage } from '../utils/errors';
import { scrapeUrl } from '../utils/scraper';
import type { GeneratedTweetMode } from '../utils/startup';
import {
    buildFeedbackSuggestion,
    calculateEditIntensity,
    FEEDBACK_TAG_OPTIONS,
    MIND_MODEL_KINDS,
    normalizeReflectionMetadata,
    normalizeStringArray,
    shouldTriggerBroadReflection,
    type BroadReflectionPrompt,
    type CaptureExtractionResult,
    type DraftFeedbackRecord,
    type EventReflection,
    type FeedbackTag,
    type MindModelEntry,
    type MindModelKind,
    type MindModelStatus,
    type ReflectionMetadata,
    type ReflectionMode,
    type ReflectionTurn,
    type SuggestedMindModelEntry,
} from '../utils/self-model';

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

// v1beta is required for gemini-embedding-001
const aiBeta = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
    apiVersion: 'v1beta',
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SKIPPED_ANSWER = '[skipped]';
const FEEDBACK_SUGGESTION_THRESHOLD = 2;

type ProfileRow = {
    id: string;
    desired_perception: string;
    target_audience: string;
    tone_guardrails: string;
    updated_at: string;
};

type ReflectionTurnRow = {
    id: string;
    mode: ReflectionMode;
    prompt: string;
    answer: string;
    context_ref_type: string;
    context_ref_id: string | null;
    derived_entry_ids: string[] | null;
    metadata: ReflectionMetadata | null;
    created_at: string;
};

type GeneratedTweetRow = {
    id: string;
    content: string;
    status: string;
    generation_mode: GeneratedTweetMode;
    theses: string[] | null;
    alternates:
        | Array<{
              draft: string;
              thesis: string;
              why_it_fits: string;
              score?: number;
          }>
        | null;
    rationale: string | null;
    created_at: string;
};

type DraftDecisionInput = {
    id: string;
    newContent: string;
    newStatus: string;
    originalContent: string;
    feedbackTags?: string[];
    freeformNote?: string;
};

type EventCaptureInput = {
    headline?: string;
    sourceUrl?: string;
    sourceText?: string;
};

function clampConfidence(value: number) {
    if (Number.isNaN(value)) {
        return 0.5;
    }

    return Math.max(0.1, Math.min(0.99, value));
}

function clampPriority(value: number) {
    if (Number.isNaN(value)) {
        return 1;
    }

    return Math.max(1, Math.min(3, Math.round(value)));
}

function isMindModelKind(value: string): value is MindModelKind {
    return (MIND_MODEL_KINDS as readonly string[]).includes(value);
}

function sanitizeSuggestedEntries(entries: SuggestedMindModelEntry[]) {
    return entries
        .filter((entry) => isMindModelKind(entry.kind) && entry.statement.trim())
        .map((entry) => ({
            kind: entry.kind,
            statement: entry.statement.trim(),
            confidence: clampConfidence(entry.confidence),
            priority: clampPriority(entry.priority),
            tags: normalizeStringArray(entry.tags),
            evidence_summary: entry.evidence_summary?.trim() || '',
        }));
}

function mapReflectionTurn(row: ReflectionTurnRow): ReflectionTurn {
    return {
        ...row,
        derived_entry_ids: normalizeStringArray(row.derived_entry_ids),
        metadata: normalizeReflectionMetadata(row.metadata),
    };
}

async function getPendingReflection(mode: ReflectionMode) {
    const { data, error } = await supabase
        .from('reflection_turns')
        .select('id, mode, prompt, answer, context_ref_type, context_ref_id, derived_entry_ids, metadata, created_at')
        .eq('mode', mode)
        .eq('answer', '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return mapReflectionTurn(data as ReflectionTurnRow);
}

async function createReflectionTurn(params: {
    mode: ReflectionMode;
    prompt: string;
    contextRefType: string;
    contextRefId?: string;
    derivedEntryIds?: string[];
    metadata?: ReflectionMetadata;
}) {
    const { data, error } = await supabase
        .from('reflection_turns')
        .insert([
            {
                mode: params.mode,
                prompt: params.prompt,
                answer: '',
                context_ref_type: params.contextRefType,
                context_ref_id: params.contextRefId || null,
                derived_entry_ids: params.derivedEntryIds || [],
                metadata: params.metadata || {},
            },
        ])
        .select('id, mode, prompt, answer, context_ref_type, context_ref_id, derived_entry_ids, metadata, created_at')
        .single();

    if (error || !data) {
        return null;
    }

    return mapReflectionTurn(data as ReflectionTurnRow);
}

async function getRecentSkippedCount(mode: ReflectionMode) {
    const { data } = await supabase
        .from('reflection_turns')
        .select('id')
        .eq('mode', mode)
        .eq('answer', SKIPPED_ANSWER)
        .order('created_at', { ascending: false })
        .limit(2);

    return data?.length || 0;
}

async function upsertSuggestedEntries(params: {
    entries: SuggestedMindModelEntry[];
    sourceType: string;
    sourceRefId?: string;
}) {
    const sanitized = sanitizeSuggestedEntries(params.entries);
    const createdEntries: MindModelEntry[] = [];

    for (const entry of sanitized) {
        const { data: existing } = await supabase
            .from('mind_model_entries')
            .select('id, kind, statement, status, confidence, priority, source_type, source_ref_id, tags, evidence_summary, created_at, updated_at')
            .eq('kind', entry.kind)
            .eq('statement', entry.statement)
            .limit(1)
            .maybeSingle();

        if (existing) {
            createdEntries.push(existing as MindModelEntry);
            continue;
        }

        const { data, error } = await supabase
            .from('mind_model_entries')
            .insert([
                {
                    kind: entry.kind,
                    statement: entry.statement,
                    status: 'suggested',
                    confidence: entry.confidence,
                    priority: entry.priority,
                    source_type: params.sourceType,
                    source_ref_id: params.sourceRefId || null,
                    tags: entry.tags || [],
                    evidence_summary: entry.evidence_summary || '',
                },
            ])
            .select('id, kind, statement, status, confidence, priority, source_type, source_ref_id, tags, evidence_summary, created_at, updated_at')
            .single();

        if (!error && data) {
            createdEntries.push(data as MindModelEntry);
        }
    }

    return createdEntries;
}

async function extractCaptureIntelligence(content: string, type: string) {
    const completionResponse = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `Content type: ${type}\n\nUser note:\n${content}`,
        config: {
            temperature: 0.3,
            systemInstruction: `You are building a self-model of the user from their raw notes.
Return JSON only:
{
  "signal_type": "observation|belief|frustration|principle|question|event_reaction",
  "should_ask_follow_up": true,
  "follow_up_question": "...",
  "candidate_entries": [
    {
      "kind": "belief|lens|taste_like|taste_avoid|current_obsession|open_question|event_pov|voice_rule",
      "statement": "...",
      "confidence": 0.72,
      "priority": 2,
      "tags": ["..."],
      "evidence_summary": "..."
    }
  ]
}`,
        },
    });

    const parsed = parseJsonResponse<CaptureExtractionResult>(
        completionResponse.text || '',
        'Failed to parse capture extraction response'
    );

    return {
        signal_type: parsed.signal_type || 'observation',
        should_ask_follow_up: Boolean(parsed.should_ask_follow_up),
        follow_up_question: parsed.follow_up_question?.trim() || '',
        candidate_entries: sanitizeSuggestedEntries(parsed.candidate_entries || []),
    };
}

async function deriveEntriesFromReflection(params: {
    mode: ReflectionMode;
    prompt: string;
    answer: string;
    contextSummary: string;
}) {
    const completionResponse = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `Reflection mode: ${params.mode}\nPrompt: ${params.prompt}\nAnswer: ${params.answer}\nContext:\n${params.contextSummary}`,
        config: {
            temperature: 0.3,
            systemInstruction: `You are updating the user's mind model from a reflection answer.
Return JSON only:
{
  "candidate_entries": [
    {
      "kind": "belief|lens|taste_like|taste_avoid|current_obsession|open_question|event_pov|voice_rule",
      "statement": "...",
      "confidence": 0.72,
      "priority": 2,
      "tags": ["..."],
      "evidence_summary": "..."
    }
  ]
}`,
        },
    });

    const parsed = parseJsonResponse<{ candidate_entries: SuggestedMindModelEntry[] }>(
        completionResponse.text || '',
        'Failed to parse reflection extraction response'
    );

    return sanitizeSuggestedEntries(parsed.candidate_entries || []);
}

async function buildBroadReflectionPromptFromContext(params: {
    recentIdeas: string[];
    confirmedEntries: MindModelEntry[];
}): Promise<BroadReflectionPrompt> {
    const completionResponse = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `Recent ideas:\n${params.recentIdeas.join('\n---\n') || 'None'}\n\nConfirmed worldview entries:\n${params.confirmedEntries
            .map((entry) => `[${entry.kind}] ${entry.statement}`)
            .join('\n') || 'None'}`,
        config: {
            temperature: 0.5,
            systemInstruction: `You are interviewing the user to understand how they think.
Return JSON only:
{
  "prompt": "...",
  "format": "open|pairwise",
  "options": ["...", "..."],
  "rationale": "..."
}`,
        },
    });

    const parsed = parseJsonResponse<BroadReflectionPrompt>(
        completionResponse.text || '',
        'Failed to parse broad reflection prompt'
    );

    return {
        prompt:
            parsed.prompt?.trim() ||
            'What kind of mistake do you think smart builders keep repeating lately?',
        format: parsed.format === 'pairwise' ? 'pairwise' : 'open',
        options: parsed.format === 'pairwise' ? normalizeStringArray(parsed.options).slice(0, 2) : [],
        rationale: parsed.rationale?.trim() || '',
    };
}

async function summarizeEventInput(input: EventCaptureInput) {
    const sourceBits = [input.headline?.trim(), input.sourceText?.trim()].filter(Boolean).join('\n\n');
    const completionResponse = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: sourceBits,
        config: {
            temperature: 0.2,
            systemInstruction: `Summarize the event neutrally.
Return JSON only:
{
  "headline": "...",
  "summary": "..."
}`,
        },
    });

    return parseJsonResponse<{ headline: string; summary: string }>(
        completionResponse.text || '',
        'Failed to parse event summary'
    );
}

async function buildEventBroaderPrompt(params: {
    sourceSummary: string;
    userTake: string;
}): Promise<BroadReflectionPrompt> {
    const completionResponse = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `Neutral summary:\n${params.sourceSummary}\n\nUser take:\n${params.userTake}`,
        config: {
            temperature: 0.4,
            systemInstruction: `Ask one broader follow-up question that reveals the user's event worldview.
Return JSON only:
{
  "prompt": "...",
  "format": "open|pairwise",
  "options": ["...", "..."],
  "rationale": "..."
}`,
        },
    });

    const parsed = parseJsonResponse<BroadReflectionPrompt>(
        completionResponse.text || '',
        'Failed to parse event follow-up prompt'
    );

    return {
        prompt:
            parsed.prompt?.trim() ||
            'What does this event reveal more clearly to you: incentives, power, timing, culture, or systems?',
        format: parsed.format === 'pairwise' ? 'pairwise' : 'open',
        options: parsed.format === 'pairwise' ? normalizeStringArray(parsed.options).slice(0, 2) : [],
        rationale: parsed.rationale?.trim() || '',
    };
}

async function deriveEventReflection(params: {
    sourceSummary: string;
    userTake: string;
    broaderAnswer: string;
}) {
    const completionResponse = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `Neutral summary:\n${params.sourceSummary}\n\nUser take:\n${params.userTake}\n\nBroader reflection:\n${params.broaderAnswer}`,
        config: {
            temperature: 0.3,
            systemInstruction: `Extract the user's point of view on the event.
Return JSON only:
{
  "derived_thesis": "...",
  "candidate_entries": [
    {
      "kind": "event_pov|belief|lens|open_question",
      "statement": "...",
      "confidence": 0.72,
      "priority": 2,
      "tags": ["..."],
      "evidence_summary": "..."
    }
  ]
}`,
        },
    });

    const parsed = parseJsonResponse<{
        derived_thesis: string;
        candidate_entries: SuggestedMindModelEntry[];
    }>(completionResponse.text || '', 'Failed to parse event reflection output');

    return {
        derived_thesis: parsed.derived_thesis?.trim() || '',
        candidate_entries: sanitizeSuggestedEntries(parsed.candidate_entries || []),
    };
}

function buildDraftFeedbackFollowUp(params: {
    editIntensity: number;
    feedbackTags: FeedbackTag[];
}) {
    if (params.feedbackTags.includes('bad_framing')) {
        return {
            prompt: 'What lens would have been more natural here?',
            metadata: {
                format: 'pairwise' as const,
                options: ['Systems or incentives', 'People or culture'],
                rationale: 'Learn the user’s preferred analytical lens.',
            },
        };
    }

    if (params.feedbackTags.includes('not_my_belief')) {
        return {
            prompt: 'Was the mismatch mainly the claim, the certainty, or the worldview behind it?',
            metadata: {
                format: 'open' as const,
                rationale: 'Clarify what made the draft feel inauthentic.',
            },
        };
    }

    if (params.feedbackTags.includes('too_generic') || params.feedbackTags.includes('too_safe')) {
        return {
            prompt: 'What sharper claim were you actually trying to make?',
            metadata: {
                format: 'open' as const,
                rationale: 'Learn the user’s preferred level of sharpness.',
            },
        };
    }

    if (params.editIntensity >= 0.45) {
        return {
            prompt: 'What did your edit improve most: belief, tone, phrasing, or framing?',
            metadata: {
                format: 'pairwise' as const,
                options: ['Belief or framing', 'Tone or phrasing'],
                rationale: 'Learn from heavy edits.',
            },
        };
    }

    return null;
}

async function maybeCreateFeedbackSuggestions(feedbackTags: FeedbackTag[]) {
    const createdEntries: MindModelEntry[] = [];

    for (const tag of feedbackTags) {
        const { data: matchingFeedback } = await supabase
            .from('draft_feedback')
            .select('id')
            .contains('feedback_tags', [tag]);

        if ((matchingFeedback?.length || 0) < FEEDBACK_SUGGESTION_THRESHOLD) {
            continue;
        }

        const suggestion = buildFeedbackSuggestion(tag);
        if (!suggestion) {
            continue;
        }

        const [entry] = await upsertSuggestedEntries({
            entries: [suggestion],
            sourceType: 'draft_feedback',
        });

        if (entry) {
            createdEntries.push(entry);
        }
    }

    return createdEntries;
}

async function getThoughtMetrics(entries: MindModelEntry[]) {
    const { data: feedbackRows } = await supabase
        .from('draft_feedback')
        .select('id, generated_tweet_id, decision, original_content, edited_content, feedback_tags, freeform_note, created_at')
        .order('created_at', { ascending: false });

    const feedback = ((feedbackRows || []) as DraftFeedbackRecord[]).map((row) => ({
        ...row,
        feedback_tags: normalizeStringArray(row.feedback_tags),
    }));

    const resolvedSuggestions = entries.filter((entry) => entry.status === 'confirmed' || entry.status === 'rejected');
    const confirmedCount = entries.filter((entry) => entry.status === 'confirmed').length;
    const suggestionConfirmationRate = resolvedSuggestions.length === 0 ? 0 : confirmedCount / resolvedSuggestions.length;

    const approvalLikeCount = feedback.filter((row) =>
        ['APPROVED', 'OPENED_IN_X', 'PUBLISHED'].includes(row.decision)
    ).length;
    const draftApprovalRate = feedback.length === 0 ? 0 : approvalLikeCount / feedback.length;

    const editIntensities = feedback
        .filter((row) => row.edited_content && row.edited_content !== row.original_content)
        .map((row) => calculateEditIntensity(row.original_content, row.edited_content || ''));
    const averageEditIntensity =
        editIntensities.length === 0
            ? 0
            : editIntensities.reduce((sum, value) => sum + value, 0) / editIntensities.length;

    const rejectedByReasonMap = new Map<string, number>();
    for (const row of feedback.filter((item) => item.decision === 'REJECTED')) {
        for (const tag of normalizeStringArray(row.feedback_tags)) {
            rejectedByReasonMap.set(tag, (rejectedByReasonMap.get(tag) || 0) + 1);
        }
    }

    return {
        suggestionConfirmationRate,
        draftApprovalRate,
        averageEditIntensity,
        rejectedByReason: Array.from(rejectedByReasonMap.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((left, right) => right.count - left.count),
        confirmedEntryCount: confirmedCount,
    };
}

export async function saveIdeaWithEmbedding(content: string, type: 'idea' | 'project_log' = 'idea') {
    if (!content || !content.trim()) {
        return { success: false, error: 'Content cannot be empty.' };
    }

    const ideaText = content.trim();

    try {
        const { data: existingIdea, error: checkError } = await supabase
            .from('raw_ideas')
            .select('id')
            .eq('content', ideaText)
            .limit(1)
            .maybeSingle();

        if (checkError) {
            console.error('Check Duplicate Error:', checkError);
        }

        if (existingIdea) {
            return { success: false, error: 'This idea is already in your vault.' };
        }

        const embeddingResponse = await aiBeta.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: ideaText,
        });

        const embedding = embeddingResponse.embeddings?.[0]?.values;
        
        if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
            return { success: false, error: `Failed to generate correct embedding dimensions. Got ${embedding?.length}, expected ${EMBEDDING_DIMENSIONS}` };
        }

        const { data: insertedIdea, error: insertError } = await supabase
            .from('raw_ideas')
            .insert([{ content: ideaText, embedding, type }])
            .select('id, content, type, created_at')
            .single();

        if (insertError || !insertedIdea) {
            return { success: false, error: 'Failed to insert idea into database.' };
        }

        let suggestedEntries: MindModelEntry[] = [];
        let reflection: ReflectionTurn | null = null;
        let signalType = 'observation';

        try {
            const skippedCount = await getRecentSkippedCount('capture_followup');
            const extraction = await extractCaptureIntelligence(ideaText, type);
            signalType = extraction.signal_type;
            suggestedEntries = await upsertSuggestedEntries({
                entries: extraction.candidate_entries,
                sourceType: 'raw_idea',
                sourceRefId: insertedIdea.id,
            });

            if (extraction.should_ask_follow_up && extraction.follow_up_question && skippedCount < 2) {
                reflection = await createReflectionTurn({
                    mode: 'capture_followup',
                    prompt: extraction.follow_up_question,
                    contextRefType: 'raw_idea',
                    contextRefId: insertedIdea.id,
                    derivedEntryIds: suggestedEntries.map((entry) => entry.id),
                    metadata: {
                        format: 'open',
                        rationale: `Clarify the user's ${extraction.signal_type}.`,
                    },
                });
            }
        } catch (extractionError) {
            console.error('Capture Extraction Error:', extractionError);
        }

        revalidatePath('/');
        revalidatePath('/vault');
        revalidatePath('/profile');

        return {
            success: true,
            savedId: insertedIdea.id,
            extraction: {
                signalType,
                suggestedEntries,
                reflection,
            },
        };
    } catch (err: unknown) {
        console.error('Action Error:', err);
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred while saving.') };
    }
}

export async function getPendingTweets(mode: GeneratedTweetMode = 'general') {
    try {
        let query = supabase
            .from('generated_tweets')
            .select('id, content, status, generation_mode, theses, alternates, rationale, created_at')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false });

        if (mode) {
            query = query.eq('generation_mode', mode);
        }

        const { data: tweets, error } = await query;

        if (error) {
            return { success: false, error: 'Failed to fetch pending tweets.', data: null };
        }

        return { success: true, data: (tweets || []) as GeneratedTweetRow[], error: null };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.'), data: null };
    }
}

export async function updateTweetStatus(id: string, newContent: string, newStatus: string) {
    try {
        const { error } = await supabase
            .from('generated_tweets')
            .update({ content: newContent, status: newStatus })
            .eq('id', id);

        if (error) {
            return { success: false, error: 'Failed to update tweet status.' };
        }

        revalidatePath('/review');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.') };
    }
}

export async function deleteGeneratedTweet(id: string) {
    try {
        await supabase
            .from('reflection_turns')
            .delete()
            .eq('context_ref_type', 'generated_tweet')
            .eq('context_ref_id', id);

        const { data, error } = await supabase
            .from('generated_tweets')
            .delete()
            .eq('id', id)
            .select('id');

        if (error || !data || data.length === 0) {
            return { success: false, error: 'Failed to delete generated tweet.' };
        }

        revalidatePath('/review');
        revalidatePath('/startup');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to delete generated tweet.') };
    }
}

export async function submitDraftDecision(input: DraftDecisionInput) {
    try {
        const filteredTags = normalizeStringArray(input.feedbackTags).filter((tag): tag is FeedbackTag =>
            (FEEDBACK_TAG_OPTIONS as readonly string[]).includes(tag)
        );

        const updateResult = await updateTweetStatus(input.id, input.newContent, input.newStatus);
        if (!updateResult.success) {
            return updateResult;
        }

        await supabase.from('draft_feedback').insert([
            {
                generated_tweet_id: input.id,
                decision: input.newStatus,
                original_content: input.originalContent,
                edited_content: input.newContent,
                feedback_tags: filteredTags,
                freeform_note: input.freeformNote?.trim() || '',
            },
        ]);

        const feedbackSuggestions = await maybeCreateFeedbackSuggestions(filteredTags);
        const followUp = buildDraftFeedbackFollowUp({
            editIntensity: calculateEditIntensity(input.originalContent, input.newContent),
            feedbackTags: filteredTags,
        });

        let reflection: ReflectionTurn | null = null;
        if (followUp && (input.newStatus === 'REJECTED' || input.newContent !== input.originalContent)) {
            reflection = await createReflectionTurn({
                mode: 'draft_feedback',
                prompt: followUp.prompt,
                contextRefType: 'generated_tweet',
                contextRefId: input.id,
                derivedEntryIds: feedbackSuggestions.map((entry) => entry.id),
                metadata: followUp.metadata,
            });
        }

        revalidatePath('/review');
        revalidatePath('/profile');

        return {
            success: true,
            feedbackSuggestions,
            reflection,
        };
    } catch (err: unknown) {
        console.error('Submit Draft Decision Error:', err);
        return { success: false, error: getErrorMessage(err, 'Failed to store draft feedback.') };
    }
}

export async function getAllIdeas() {
    try {
        const { data: ideas, error } = await supabase
            .from('raw_ideas')
            .select('id, content, type, metadata, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            return { success: false, error: 'Failed to fetch ideas.', data: null };
        }

        return { success: true, data: ideas, error: null };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.'), data: null };
    }
}

export async function getTweetHistory(mode: GeneratedTweetMode | 'all' = 'all') {
    try {
        let query = supabase
            .from('generated_tweets')
            .select('id, content, status, generation_mode, theses, alternates, rationale, created_at')
            .neq('status', 'PENDING')
            .order('created_at', { ascending: false });

        if (mode !== 'all') {
            query = query.eq('generation_mode', mode);
        }

        const { data: tweets, error } = await query;

        if (error) {
            return { success: false, error: 'Failed to fetch tweet history.', data: null };
        }

        return { success: true, data: (tweets || []) as GeneratedTweetRow[], error: null };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.'), data: null };
    }
}

export async function analyzePersona() {
    try {
        const { data: tweets, error: tweetsError } = await supabase
            .from('generated_tweets')
            .select('content')
            .in('status', ['APPROVED', 'OPENED_IN_X', 'PUBLISHED']);

        if (tweetsError) {
            return { success: false, error: 'Failed to fetch approved tweets.', data: null };
        }

        if (!tweets || tweets.length < 3) {
            return { success: false, error: 'Not enough data to analyze persona. Approve or open more drafts first.', data: null };
        }

        const tweetContents = tweets.map((tweet) => tweet.content).join('\n---\n');
        const completionResponse = await ai.models.generateContent({
            model: GENERATION_MODEL,
            contents: `Here are the tweets:\n${tweetContents}`,
            config: {
                systemInstruction:
                    'You are an expert psychological profiler and brand analyst. Provide a brutal, objective breakdown of the public persona projected by these tweets in 3-4 short paragraphs.',
                temperature: 0.7,
            },
        });

        const analysis = completionResponse.text || '';
        if (!analysis) {
            return { success: false, error: 'Failed to generate persona analysis.', data: null };
        }

        return { success: true, data: analysis, error: null };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.'), data: null };
    }
}

export async function getProfile() {
    try {
        const { data: profile, error } = await supabase
            .from('user_profile')
            .select('id, desired_perception, target_audience, tone_guardrails, updated_at')
            .limit(1)
            .single();

        if (error) {
            return { success: false, error: 'Failed to fetch profile.', data: null };
        }

        return { success: true, data: profile as ProfileRow, error: null };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.'), data: null };
    }
}

export async function updateProfile(data: {
    id?: string;
    desired_perception: string;
    target_audience: string;
    tone_guardrails: string;
}) {
    try {
        if (data.id) {
            const { error } = await supabase
                .from('user_profile')
                .update({
                    desired_perception: data.desired_perception,
                    target_audience: data.target_audience,
                    tone_guardrails: data.tone_guardrails,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', data.id);

            if (error) {
                return { success: false, error: 'Failed to update profile.' };
            }
        } else {
            const { error } = await supabase.from('user_profile').insert([
                {
                    desired_perception: data.desired_perception,
                    target_audience: data.target_audience,
                    tone_guardrails: data.tone_guardrails,
                    updated_at: new Date().toISOString(),
                },
            ]);

            if (error) {
                return { success: false, error: 'Failed to create profile.' };
            }
        }

        revalidatePath('/profile');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.') };
    }
}

export async function getRawIdeas() {
    try {
        const { data: ideas, error } = await supabase
            .from('raw_ideas')
            .select('id, content, type, metadata, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            return { success: false, error: 'Failed to fetch raw ideas.', data: null };
        }

        return { success: true, data: ideas, error: null };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.'), data: null };
    }
}

export async function deleteRawIdea(id: string) {
    try {
        const { data, error } = await supabase
            .from('raw_ideas')
            .delete()
            .eq('id', id)
            .select();

        if (error || !data || data.length === 0) {
            return { success: false, error: 'Failed to delete raw idea.' };
        }

        revalidatePath('/vault');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'An unexpected error occurred.') };
    }
}

export async function saveUrlAsIdea(url: string) {
    if (!url || !url.trim()) {
        return { success: false, error: 'URL cannot be empty.' };
    }

    try {
        const { data: existingUrl, error: checkError } = await supabase
            .from('raw_ideas')
            .select('id')
            .eq('metadata->>source_url', url)
            .limit(1)
            .maybeSingle();

        if (checkError) {
            console.error('Check Duplicate URL Error:', checkError);
        }

        if (existingUrl) {
            return { success: false, error: 'This URL has already been ingested into your vault.' };
        }

        const scrapeResult = await scrapeUrl(url);
        if (!scrapeResult.success) {
            return { success: false, error: scrapeResult.error || 'Failed to scrape the URL.' };
        }

        const embeddingResponse = await aiBeta.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: scrapeResult.content,
        });

        const embedding = embeddingResponse.embeddings?.[0]?.values;
        if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
            return { success: false, error: 'Failed to generate correct embedding dimensions.' };
        }

        const { error: insertError } = await supabase.from('raw_ideas').insert([
            {
                content: scrapeResult.content,
                embedding,
                type: 'url',
                metadata: {
                    source_url: url,
                    title: scrapeResult.title || 'Untitled Source',
                },
            },
        ]);

        if (insertError) {
            return { success: false, error: 'Failed to save the scraped content to the database.' };
        }

        revalidatePath('/vault');
        return { success: true, title: scrapeResult.title || 'Untitled Source' };
    } catch (err: unknown) {
        return {
            success: false,
            error: getErrorMessage(err, 'An unexpected error occurred while processing the URL.'),
        };
    }
}

export async function analyzeAndSavePersona(handle: string, tweets: string[]) {
    if (!handle || !tweets || tweets.length < 3 || tweets.length > 5) {
        return { success: false, error: 'Please provide a handle and 3 to 5 tweets.' };
    }

    try {
        const normalizedHandle = handle.replace(/^@+/, '').trim();
        const tweetContent = tweets.map((tweet, index) => `Tweet ${index + 1}: ${tweet}`).join('\n\n');

        const completionResponse = await ai.models.generateContent({
            model: GENERATION_MODEL,
            contents: `Analyze the voice of @${normalizedHandle} based on these golden tweets:\n\n${tweetContent}`,
            config: {
                systemInstruction:
                    'You are a brand strategist. Output a concise Voice Framework covering sentence structure, tone, vocabulary choices, and formatting quirks.',
                temperature: 0.7,
            },
        });

        const voiceProfile = completionResponse.text || '';
        if (!voiceProfile) {
            return { success: false, error: 'Failed to generate voice profile.' };
        }

        const { error: insertError } = await supabase.from('creator_personas').insert([
            {
                handle: normalizedHandle,
                golden_tweets: tweets,
                ai_voice_profile: voiceProfile,
            },
        ]);

        if (insertError) {
            return { success: false, error: 'Failed to save persona to database.' };
        }

        revalidatePath('/');
        revalidatePath('/profile');
        return { success: true, data: voiceProfile };
    } catch (err: unknown) {
        return {
            success: false,
            error: getErrorMessage(err, 'An unexpected error occurred while analyzing the persona.'),
        };
    }
}

export async function getHomeLearningState() {
    try {
        return {
            success: true,
            data: {
                pendingCapture: await getPendingReflection('capture_followup'),
                pendingNews: await getPendingReflection('news_reflection'),
            },
        };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to load learning state.') };
    }
}

export async function getReviewLearningState() {
    try {
        return {
            success: true,
            data: {
                pendingFeedback: await getPendingReflection('draft_feedback'),
            },
        };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to load review learning state.') };
    }
}

export async function createEventReflection(input: EventCaptureInput) {
    if (!input.headline?.trim() && !input.sourceUrl?.trim() && !input.sourceText?.trim()) {
        return { success: false, error: 'Add a headline, URL, or summary first.' };
    }

    try {
        let sourceText = input.sourceText?.trim() || '';
        let derivedHeadline = input.headline?.trim() || '';

        if (input.sourceUrl?.trim()) {
            const scrapeResult = await scrapeUrl(input.sourceUrl.trim());
            if (scrapeResult.success) {
                sourceText = sourceText || scrapeResult.content;
                derivedHeadline = derivedHeadline || scrapeResult.title || '';
            }
        }

        const summary = await summarizeEventInput({
            headline: derivedHeadline || input.headline?.trim(),
            sourceText,
        });

        const { data: eventReflection, error: eventError } = await supabase
            .from('event_reflections')
            .insert([
                {
                    headline: summary.headline || derivedHeadline || input.headline?.trim() || 'Untitled event',
                    source_url: input.sourceUrl?.trim() || null,
                    source_summary: summary.summary,
                    status: 'captured',
                },
            ])
            .select('id, headline, source_url, source_summary, user_take, derived_thesis, status, created_at')
            .single();

        if (eventError || !eventReflection) {
            return { success: false, error: 'Failed to save event reflection.' };
        }

        const reflection = await createReflectionTurn({
            mode: 'news_reflection',
            prompt: 'What is your actual take on this event?',
            contextRefType: 'event_reflection',
            contextRefId: eventReflection.id,
            metadata: {
                format: 'open',
                stage: 'take',
                event_reflection_id: eventReflection.id,
                rationale: 'Capture the user’s immediate stance before expanding it.',
            },
        });

        revalidatePath('/');
        revalidatePath('/profile');

        return {
            success: true,
            data: {
                event: eventReflection as EventReflection,
                reflection,
            },
        };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to create event reflection.') };
    }
}

export async function answerReflectionTurn(id: string, answer: string) {
    if (!answer.trim()) {
        return { success: false, error: 'Answer cannot be empty.' };
    }

    try {
        const { data: reflectionRow, error: reflectionError } = await supabase
            .from('reflection_turns')
            .select('id, mode, prompt, answer, context_ref_type, context_ref_id, derived_entry_ids, metadata, created_at')
            .eq('id', id)
            .single();

        if (reflectionError || !reflectionRow) {
            return { success: false, error: 'Reflection prompt not found.' };
        }

        const reflection = mapReflectionTurn(reflectionRow as ReflectionTurnRow);
        let addedEntries: MindModelEntry[] = [];
        let nextReflection: ReflectionTurn | null = null;
        let event: EventReflection | null = null;

        if (reflection.mode === 'capture_followup') {
            const { data: rawIdea } = await supabase
                .from('raw_ideas')
                .select('content, type')
                .eq('id', reflection.context_ref_id)
                .maybeSingle();

            const entries = await deriveEntriesFromReflection({
                mode: reflection.mode,
                prompt: reflection.prompt,
                answer,
                contextSummary: rawIdea ? `[${rawIdea.type}] ${rawIdea.content}` : 'Raw idea context unavailable.',
            });

            addedEntries = await upsertSuggestedEntries({
                entries,
                sourceType: 'capture_followup',
                sourceRefId: reflection.context_ref_id || undefined,
            });
        }

        if (reflection.mode === 'broad_reflection') {
            const { data: recentIdeas } = await supabase
                .from('raw_ideas')
                .select('content')
                .order('created_at', { ascending: false })
                .limit(6);

            const entries = await deriveEntriesFromReflection({
                mode: reflection.mode,
                prompt: reflection.prompt,
                answer,
                contextSummary: recentIdeas?.map((idea) => idea.content).join('\n---\n') || 'No recent idea context available.',
            });

            addedEntries = await upsertSuggestedEntries({
                entries,
                sourceType: 'broad_reflection',
                sourceRefId: reflection.id,
            });
        }

        if (reflection.mode === 'draft_feedback') {
            const { data: feedbackRows } = await supabase
                .from('draft_feedback')
                .select('decision, original_content, edited_content, feedback_tags, freeform_note')
                .eq('generated_tweet_id', reflection.context_ref_id)
                .order('created_at', { ascending: false })
                .limit(1);

            const latestFeedback = feedbackRows?.[0];
            const contextSummary = latestFeedback
                ? `Decision: ${latestFeedback.decision}\nOriginal: ${latestFeedback.original_content}\nEdited: ${
                      latestFeedback.edited_content || latestFeedback.original_content
                  }\nTags: ${normalizeStringArray(latestFeedback.feedback_tags).join(', ')}`
                : 'Draft feedback context unavailable.';

            const entries = await deriveEntriesFromReflection({
                mode: reflection.mode,
                prompt: reflection.prompt,
                answer,
                contextSummary,
            });

            addedEntries = await upsertSuggestedEntries({
                entries,
                sourceType: 'draft_feedback_reflection',
                sourceRefId: reflection.context_ref_id || undefined,
            });
        }

        if (reflection.mode === 'news_reflection') {
            const metadata = normalizeReflectionMetadata(reflection.metadata);
            const eventId = metadata.event_reflection_id || reflection.context_ref_id || '';
            const { data: eventRow } = await supabase
                .from('event_reflections')
                .select('id, headline, source_url, source_summary, user_take, derived_thesis, status, created_at')
                .eq('id', eventId)
                .single();

            if (eventRow) {
                event = eventRow as EventReflection;
            }

            if (metadata.stage === 'take' && event) {
                await supabase
                    .from('event_reflections')
                    .update({ user_take: answer.trim(), status: 'captured' })
                    .eq('id', event.id);

                const broaderPrompt = await buildEventBroaderPrompt({
                    sourceSummary: event.source_summary,
                    userTake: answer.trim(),
                });

                nextReflection = await createReflectionTurn({
                    mode: 'news_reflection',
                    prompt: broaderPrompt.prompt,
                    contextRefType: 'event_reflection',
                    contextRefId: event.id,
                    metadata: {
                        format: broaderPrompt.format,
                        options: broaderPrompt.options,
                        stage: 'broader',
                        rationale: broaderPrompt.rationale,
                        event_reflection_id: event.id,
                    },
                });
            } else if (event) {
                const result = await deriveEventReflection({
                    sourceSummary: event.source_summary,
                    userTake: event.user_take || '',
                    broaderAnswer: answer.trim(),
                });

                addedEntries = await upsertSuggestedEntries({
                    entries: result.candidate_entries,
                    sourceType: 'event_reflection',
                    sourceRefId: event.id,
                });

                const { data: updatedEvent } = await supabase
                    .from('event_reflections')
                    .update({ derived_thesis: result.derived_thesis, status: 'reflected' })
                    .eq('id', event.id)
                    .select('id, headline, source_url, source_summary, user_take, derived_thesis, status, created_at')
                    .single();

                if (updatedEvent) {
                    event = updatedEvent as EventReflection;
                }
            }
        }

        await supabase
            .from('reflection_turns')
            .update({
                answer: answer.trim(),
                derived_entry_ids: [...normalizeStringArray(reflection.derived_entry_ids), ...addedEntries.map((entry) => entry.id)],
            })
            .eq('id', reflection.id);

        revalidatePath('/');
        revalidatePath('/review');
        revalidatePath('/profile');

        return { success: true, addedEntries, nextReflection, event };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to save reflection answer.') };
    }
}

export async function skipReflectionTurn(id: string) {
    try {
        const { error } = await supabase
            .from('reflection_turns')
            .update({ answer: SKIPPED_ANSWER })
            .eq('id', id);

        if (error) {
            return { success: false, error: 'Failed to skip reflection prompt.' };
        }

        revalidatePath('/');
        revalidatePath('/review');
        revalidatePath('/profile');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to skip reflection prompt.') };
    }
}

export async function getMindModelWorkspace() {
    try {
        const profileResult = await getProfile();
        const profile = profileResult.success ? profileResult.data : null;

        const { data: entryRows } = await supabase
            .from('mind_model_entries')
            .select('id, kind, statement, status, confidence, priority, source_type, source_ref_id, tags, evidence_summary, created_at, updated_at')
            .order('status', { ascending: true })
            .order('priority', { ascending: false })
            .order('updated_at', { ascending: false });

        const entries = (entryRows || []) as MindModelEntry[];
        let pendingBroadReflection = await getPendingReflection('broad_reflection');

        if (!pendingBroadReflection) {
            const { data: recentIdeas } = await supabase
                .from('raw_ideas')
                .select('id, content, created_at')
                .order('created_at', { ascending: false })
                .limit(12);

            const { data: lastBroadReflection } = await supabase
                .from('reflection_turns')
                .select('created_at')
                .eq('mode', 'broad_reflection')
                .neq('answer', '')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const newIdeaCount = lastBroadReflection
                ? (recentIdeas || []).filter((idea) => new Date(idea.created_at) > new Date(lastBroadReflection.created_at)).length
                : recentIdeas?.length || 0;
            const unresolvedOpenQuestionCount = entries.filter(
                (entry) => entry.kind === 'open_question' && entry.status !== 'archived'
            ).length;

            if (
                shouldTriggerBroadReflection({
                    newIdeaCount,
                    lastBroadReflectionAt: lastBroadReflection?.created_at || null,
                    unresolvedOpenQuestionCount,
                })
            ) {
                const prompt = await buildBroadReflectionPromptFromContext({
                    recentIdeas: (recentIdeas || []).map((idea) => idea.content),
                    confirmedEntries: entries.filter((entry) => entry.status === 'confirmed'),
                });

                pendingBroadReflection = await createReflectionTurn({
                    mode: 'broad_reflection',
                    prompt: prompt.prompt,
                    contextRefType: 'mind_model',
                    metadata: {
                        format: prompt.format,
                        options: prompt.options,
                        rationale: prompt.rationale,
                        stage: 'reflect',
                    },
                });
            }
        }

        const { data: eventRows } = await supabase
            .from('event_reflections')
            .select('id, headline, source_url, source_summary, user_take, derived_thesis, status, created_at')
            .order('created_at', { ascending: false })
            .limit(8);

        const metrics = await getThoughtMetrics(entries);

        return {
            success: true,
            data: {
                profile,
                entries,
                eventReflections: (eventRows || []) as EventReflection[],
                pendingBroadReflection,
                metrics,
            },
        };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to load mind model workspace.') };
    }
}

export async function resolveMindModelEntry(params: {
    id: string;
    action: 'confirm' | 'reject' | 'archive';
    statement?: string;
}) {
    try {
        const nextStatus: MindModelStatus =
            params.action === 'confirm'
                ? 'confirmed'
                : params.action === 'reject'
                ? 'rejected'
                : 'archived';

        const { error } = await supabase
            .from('mind_model_entries')
            .update({
                status: nextStatus,
                statement: params.statement?.trim() || undefined,
                updated_at: new Date().toISOString(),
            })
            .eq('id', params.id);

        if (error) {
            return { success: false, error: 'Failed to update mind-model entry.' };
        }

        revalidatePath('/profile');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to update mind-model entry.') };
    }
}
