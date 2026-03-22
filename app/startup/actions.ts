'use server';

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';
import {
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    GENERATION_MODEL,
} from '@/utils/ai-config';
import { parseJsonResponse } from '@/utils/ai-json';
import { getErrorMessage } from '@/utils/errors';
import {
    getStartupMemoryKindLabel,
    isStartupMemoryKind,
    normalizeStartupMetadata,
    normalizeStartupReflectionMetadata,
    normalizeStartupSuggestions,
    type StartupCaptureSuggestion,
    type StartupMemoryEntry,
    type StartupMemoryKind,
    type StartupProfile,
    type StartupReflectionMetadata,
    type StartupReflectionTurn,
} from '@/utils/startup';

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
});

const aiBeta = new GoogleGenAI({
    apiKey: process.env.GOOGLE_API_KEY,
    apiVersion: 'v1beta',
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SKIPPED_ANSWER = '[skipped]';

type StartupProfileRow = StartupProfile;

type StartupMemoryEntryRow = {
    id: string;
    content: string;
    kind: StartupMemoryKind;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

type StartupReflectionTurnRow = {
    id: string;
    mode: 'capture_followup';
    prompt: string;
    answer: string;
    startup_memory_entry_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
};

async function ensureStartupProfileRow() {
    const { data: existingProfile, error: existingError } = await supabase
        .from('startup_profiles')
        .select(
            'id, startup_name, one_liner, target_customer, painful_problem, transformation, positioning, proof_points, objections, language_guardrails, updated_at'
        )
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!existingError && existingProfile) {
        return existingProfile as StartupProfileRow;
    }

    const { data: insertedProfile, error: insertError } = await supabase
        .from('startup_profiles')
        .insert([
            {
                startup_name: '',
                one_liner: '',
                target_customer: '',
                painful_problem: '',
                transformation: '',
                positioning: '',
                proof_points: '',
                objections: '',
                language_guardrails: '',
                updated_at: new Date().toISOString(),
            },
        ])
        .select(
            'id, startup_name, one_liner, target_customer, painful_problem, transformation, positioning, proof_points, objections, language_guardrails, updated_at'
        )
        .single();

    if (insertError || !insertedProfile) {
        throw new Error('Failed to initialize startup profile.');
    }

    return insertedProfile as StartupProfileRow;
}

function mapStartupMemoryEntry(row: StartupMemoryEntryRow): StartupMemoryEntry {
    return {
        ...row,
        metadata: normalizeStartupMetadata(row.metadata),
    };
}

function mapStartupReflectionTurn(row: StartupReflectionTurnRow): StartupReflectionTurn {
    return {
        ...row,
        metadata: normalizeStartupReflectionMetadata(row.metadata),
    };
}

async function getPendingStartupReflection() {
    const { data, error } = await supabase
        .from('startup_reflection_turns')
        .select('id, mode, prompt, answer, startup_memory_entry_id, metadata, created_at')
        .eq('mode', 'capture_followup')
        .eq('answer', '')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        return null;
    }

    return mapStartupReflectionTurn(data as StartupReflectionTurnRow);
}

async function getRecentSkippedStartupReflectionCount() {
    const { data } = await supabase
        .from('startup_reflection_turns')
        .select('id')
        .eq('mode', 'capture_followup')
        .eq('answer', SKIPPED_ANSWER)
        .order('created_at', { ascending: false })
        .limit(2);

    return data?.length || 0;
}

async function createStartupReflectionTurn(params: {
    prompt: string;
    startupMemoryEntryId: string;
    metadata?: StartupReflectionMetadata;
}) {
    const { data, error } = await supabase
        .from('startup_reflection_turns')
        .insert([
            {
                mode: 'capture_followup',
                prompt: params.prompt,
                answer: '',
                startup_memory_entry_id: params.startupMemoryEntryId,
                metadata: params.metadata || {},
            },
        ])
        .select('id, mode, prompt, answer, startup_memory_entry_id, metadata, created_at')
        .single();

    if (error || !data) {
        return null;
    }

    return mapStartupReflectionTurn(data as StartupReflectionTurnRow);
}

function buildStartupProfileSummary(profile: StartupProfile | null) {
    if (!profile) {
        return 'No startup profile exists yet.';
    }

    return [
        `Startup: ${profile.startup_name || 'Unknown'}`,
        `One-liner: ${profile.one_liner || 'None yet'}`,
        `Target customer: ${profile.target_customer || 'None yet'}`,
        `Painful problem: ${profile.painful_problem || 'None yet'}`,
        `Transformation: ${profile.transformation || 'None yet'}`,
        `Positioning: ${profile.positioning || 'None yet'}`,
        `Proof points: ${profile.proof_points || 'None yet'}`,
        `Objections: ${profile.objections || 'None yet'}`,
        `Language guardrails: ${profile.language_guardrails || 'None yet'}`,
    ].join('\n');
}

async function extractStartupCaptureIntelligence(params: {
    content: string;
    kind: StartupMemoryKind;
    profile: StartupProfile | null;
}) {
    const completionResponse = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `Startup memory type: ${params.kind}\nLabel: ${getStartupMemoryKindLabel(
            params.kind
        )}\n\nStartup profile:\n${buildStartupProfileSummary(params.profile)}\n\nCaptured note:\n${
            params.content
        }`,
        config: {
            temperature: 0.35,
            systemInstruction: `You are helping turn raw startup thoughts into clearer public communication.
Return JSON only:
{
  "communication_focus": "...",
  "suggested_points": ["...", "..."],
  "should_ask_follow_up": true,
  "follow_up_question": "..."
}

Rules:
- communication_focus should say what this note is most useful for in communication.
- suggested_points should be short, concrete angles to mention publicly.
- Ask a follow-up only if one question would make the startup clearer to outsiders.`,
        },
    });

    const parsed = parseJsonResponse<StartupCaptureSuggestion>(
        completionResponse.text || '',
        'Failed to parse startup capture intelligence'
    );

    return {
        communication_focus: parsed.communication_focus?.trim() || '',
        suggested_points: normalizeStartupSuggestions(parsed.suggested_points).slice(0, 4),
        should_ask_follow_up: Boolean(parsed.should_ask_follow_up),
        follow_up_question: parsed.follow_up_question?.trim() || '',
    };
}

async function deriveStartupReflectionSummary(params: {
    prompt: string;
    answer: string;
    content: string;
    kind: StartupMemoryKind;
    profile: StartupProfile | null;
}) {
    const completionResponse = await ai.models.generateContent({
        model: GENERATION_MODEL,
        contents: `Startup profile:\n${buildStartupProfileSummary(params.profile)}\n\nMemory type: ${
            params.kind
        }\n\nOriginal startup note:\n${params.content}\n\nFollow-up prompt:\n${params.prompt}\n\nUser answer:\n${
            params.answer
        }`,
        config: {
            temperature: 0.35,
            systemInstruction: `You are extracting clearer startup communication material from a follow-up answer.
Return JSON only:
{
  "communication_focus": "...",
  "suggested_points": ["...", "..."]
}

Rules:
- suggested_points should help explain the startup better to broader people.
- Keep them concrete, not generic advice.`,
        },
    });

    const parsed = parseJsonResponse<{
        communication_focus?: string;
        suggested_points?: string[];
    }>(completionResponse.text || '', 'Failed to parse startup reflection summary');

    return {
        communication_focus: parsed.communication_focus?.trim() || '',
        suggested_points: normalizeStartupSuggestions(parsed.suggested_points).slice(0, 5),
    };
}

export async function getStartupWorkspace() {
    try {
        const [profile, { data: memoryEntries }, pendingReflectionResult, { data: recentDrafts }] =
            await Promise.all([
                ensureStartupProfileRow(),
                supabase
                    .from('startup_memory_entries')
                    .select('id, content, kind, metadata, created_at')
                    .order('created_at', { ascending: false })
                    .limit(24),
                getPendingStartupReflection(),
                supabase
                    .from('generated_tweets')
                    .select('id, content, status, generation_mode, theses, alternates, rationale, created_at')
                    .eq('generation_mode', 'startup')
                    .order('created_at', { ascending: false })
                    .limit(8),
            ]);

        const { data: recentAnswered } = await supabase
            .from('startup_reflection_turns')
            .select('id, mode, prompt, answer, startup_memory_entry_id, metadata, created_at')
            .neq('answer', '')
            .neq('answer', SKIPPED_ANSWER)
            .order('created_at', { ascending: false })
            .limit(6);

        return {
            success: true,
            data: {
                profile: profile || null,
                memoryEntries: ((memoryEntries || []) as StartupMemoryEntryRow[]).map(mapStartupMemoryEntry),
                pendingReflection: pendingReflectionResult,
                recentAnsweredReflections: ((recentAnswered || []) as StartupReflectionTurnRow[]).map(
                    mapStartupReflectionTurn
                ),
                recentDrafts: (recentDrafts || []) as Array<{
                    id: string;
                    content: string;
                    status: string;
                    generation_mode: 'startup';
                    theses: string[] | null;
                    alternates: Array<{
                        draft: string;
                        thesis: string;
                        why_it_fits: string;
                        score?: number;
                    }> | null;
                    rationale: string | null;
                    created_at: string;
                }>,
            },
        };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to load startup workspace.') };
    }
}

export async function updateStartupProfile(
    input: Omit<StartupProfile, 'updated_at' | 'id'> & { id?: string }
) {
    try {
        const existingProfile = await ensureStartupProfileRow();
        const payload = {
            startup_name: input.startup_name.trim(),
            one_liner: input.one_liner.trim(),
            target_customer: input.target_customer.trim(),
            painful_problem: input.painful_problem.trim(),
            transformation: input.transformation.trim(),
            positioning: input.positioning.trim(),
            proof_points: input.proof_points.trim(),
            objections: input.objections.trim(),
            language_guardrails: input.language_guardrails.trim(),
            updated_at: new Date().toISOString(),
        };

        let { data: updatedRows, error } = await supabase
            .from('startup_profiles')
            .update(payload)
            .eq('id', input.id || existingProfile.id)
            .select('id');

        if ((!updatedRows || updatedRows.length === 0) && (!input.id || input.id !== existingProfile.id)) {
            ({ data: updatedRows, error } = await supabase
                .from('startup_profiles')
                .update(payload)
                .eq('id', existingProfile.id)
                .select('id'));
        }

        if (error || !updatedRows || updatedRows.length === 0) {
            return { success: false, error: 'Failed to update startup profile.' };
        }

        revalidatePath('/startup');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to update startup profile.') };
    }
}

export async function saveStartupMemoryEntry(content: string, kind: StartupMemoryKind) {
    if (!content.trim()) {
        return { success: false, error: 'Startup memory cannot be empty.' };
    }

    if (!isStartupMemoryKind(kind)) {
        return { success: false, error: 'Invalid startup memory type.' };
    }

    try {
        const trimmedContent = content.trim();
        const { data: existingEntry } = await supabase
            .from('startup_memory_entries')
            .select('id')
            .eq('content', trimmedContent)
            .limit(1)
            .maybeSingle();

        if (existingEntry) {
            return { success: false, error: 'This startup memory is already saved.' };
        }

        const [profile, embeddingResponse] = await Promise.all([
            ensureStartupProfileRow(),
            aiBeta.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: trimmedContent,
            }),
        ]);

        const embedding = embeddingResponse.embeddings?.[0]?.values;
        if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
            return {
                success: false,
                error: `Failed to generate correct embedding dimensions. Got ${embedding?.length}, expected ${EMBEDDING_DIMENSIONS}`,
            };
        }

        const startupProfile = profile || null;
        const suggestion = await extractStartupCaptureIntelligence({
            content: trimmedContent,
            kind,
            profile: startupProfile,
        });

        const { data: insertedEntry, error: insertError } = await supabase
            .from('startup_memory_entries')
            .insert([
                {
                    content: trimmedContent,
                    kind,
                    embedding,
                    metadata: {
                        communication_focus: suggestion.communication_focus,
                        suggested_points: suggestion.suggested_points,
                    },
                },
            ])
            .select('id, content, kind, metadata, created_at')
            .single();

        if (insertError || !insertedEntry) {
            return { success: false, error: 'Failed to save startup memory.' };
        }

        let reflection: StartupReflectionTurn | null = null;
        const skippedCount = await getRecentSkippedStartupReflectionCount();
        if (
            suggestion.should_ask_follow_up &&
            suggestion.follow_up_question &&
            skippedCount < 2
        ) {
            reflection = await createStartupReflectionTurn({
                prompt: suggestion.follow_up_question,
                startupMemoryEntryId: insertedEntry.id,
                metadata: {
                    format: 'open',
                    rationale:
                        'One follow-up helps translate the raw founder note into clearer public communication.',
                    suggestions: suggestion.suggested_points,
                    focus: suggestion.communication_focus,
                },
            });
        }

        revalidatePath('/startup');

        return {
            success: true,
            data: {
                entry: mapStartupMemoryEntry(insertedEntry as StartupMemoryEntryRow),
                suggestion,
                reflection,
            },
        };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to save startup memory.') };
    }
}

export async function deleteStartupMemoryEntry(id: string) {
    try {
        const { data, error } = await supabase
            .from('startup_memory_entries')
            .delete()
            .eq('id', id)
            .select('id');

        if (error || !data || data.length === 0) {
            return { success: false, error: 'Failed to delete startup memory.' };
        }

        revalidatePath('/startup');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to delete startup memory.') };
    }
}

export async function answerStartupReflectionTurn(id: string, answer: string) {
    if (!answer.trim()) {
        return { success: false, error: 'Answer cannot be empty.' };
    }

    try {
        const { data: reflectionRow, error: reflectionError } = await supabase
            .from('startup_reflection_turns')
            .select('id, mode, prompt, answer, startup_memory_entry_id, metadata, created_at')
            .eq('id', id)
            .single();

        if (reflectionError || !reflectionRow) {
            return { success: false, error: 'Startup reflection not found.' };
        }

        const reflection = mapStartupReflectionTurn(reflectionRow as StartupReflectionTurnRow);
        const { data: memoryRow, error: memoryError } = await supabase
            .from('startup_memory_entries')
            .select('id, content, kind, metadata, created_at')
            .eq('id', reflection.startup_memory_entry_id)
            .single();

        if (memoryError || !memoryRow) {
            return { success: false, error: 'Related startup memory was not found.' };
        }

        const profile = await ensureStartupProfileRow();

        const parsedEntry = mapStartupMemoryEntry(memoryRow as StartupMemoryEntryRow);
        const derived = await deriveStartupReflectionSummary({
            prompt: reflection.prompt,
            answer: answer.trim(),
            content: parsedEntry.content,
            kind: parsedEntry.kind,
            profile: profile || null,
        });

        const nextSuggestedPoints = Array.from(
            new Set([
                ...normalizeStartupSuggestions(parsedEntry.metadata?.suggested_points),
                ...derived.suggested_points,
            ])
        ).slice(0, 6);

        await Promise.all([
            supabase
                .from('startup_reflection_turns')
                .update({ answer: answer.trim() })
                .eq('id', reflection.id),
            supabase
                .from('startup_memory_entries')
                .update({
                    metadata: {
                        ...parsedEntry.metadata,
                        communication_focus:
                            derived.communication_focus || parsedEntry.metadata?.communication_focus || '',
                        suggested_points: nextSuggestedPoints,
                        follow_up_answer: answer.trim(),
                    },
                })
                .eq('id', parsedEntry.id),
        ]);

        revalidatePath('/startup');

        return {
            success: true,
            data: {
                updatedEntry: {
                    ...parsedEntry,
                    metadata: {
                        ...parsedEntry.metadata,
                        communication_focus:
                            derived.communication_focus || parsedEntry.metadata?.communication_focus || '',
                        suggested_points: nextSuggestedPoints,
                        follow_up_answer: answer.trim(),
                    },
                } satisfies StartupMemoryEntry,
                suggestions: nextSuggestedPoints,
            },
        };
    } catch (err: unknown) {
        return {
            success: false,
            error: getErrorMessage(err, 'Failed to save startup reflection answer.'),
        };
    }
}

export async function skipStartupReflectionTurn(id: string) {
    try {
        const { error } = await supabase
            .from('startup_reflection_turns')
            .update({ answer: SKIPPED_ANSWER })
            .eq('id', id);

        if (error) {
            return { success: false, error: 'Failed to skip startup reflection.' };
        }

        revalidatePath('/startup');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: getErrorMessage(err, 'Failed to skip startup reflection.') };
    }
}
