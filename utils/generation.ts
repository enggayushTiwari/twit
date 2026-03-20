import type { MindModelEntry } from "./self-model";

export type CreatorPersonaRecord = {
  handle: string;
  ai_voice_profile: string;
} | null;

export type UserProfileRecord = {
  desired_perception?: string | null;
  target_audience?: string | null;
  tone_guardrails?: string | null;
} | null;

type BuildGenerationSystemPromptParams = {
  profile: UserProfileRecord;
  creatorPersona: CreatorPersonaRecord;
  sourceType?: string | null;
  contextIdeas: string;
  pastTweets: string;
  confirmedEntries?: MindModelEntry[];
  currentObsessions?: string[];
  recentEventPovs?: string[];
};

type BuildCandidatePromptParams = {
  seedIdea: string;
  thesisCount?: number;
  draftCount?: number;
};

function getProfileLine(value: string | null | undefined, fallback: string) {
  return value && value.trim() ? value.trim() : fallback;
}

function getCreatorVoiceSection(creatorPersona: CreatorPersonaRecord) {
  if (!creatorPersona?.ai_voice_profile?.trim()) {
    return `- REFERENCE VOICE: None selected. Use only the user's profile guardrails and source material.`;
  }

  return [
    `- REFERENCE VOICE HANDLE: @${creatorPersona.handle}`,
    `- REFERENCE VOICE FRAMEWORK: ${creatorPersona.ai_voice_profile.trim()}`,
    `- REFERENCE VOICE RULE: Borrow rhythm and structural cues only when they do not conflict with the user's profile. Do not imitate catchphrases or obvious signature lines.`,
  ].join("\n");
}

function formatMindModelEntries(entries: MindModelEntry[] | undefined) {
  if (!entries || entries.length === 0) {
    return "None";
  }

  return entries
    .map(
      (entry) =>
        `[${entry.kind.toUpperCase()} | p${entry.priority} | c${entry.confidence.toFixed(2)}] ${entry.statement}`
    )
    .join("\n");
}

function formatStringList(items: string[] | undefined) {
  if (!items || items.length === 0) {
    return "None";
  }

  return items.join("\n");
}

export function buildGenerationSystemPrompt({
  profile,
  creatorPersona,
  sourceType,
  contextIdeas,
  pastTweets,
  confirmedEntries,
  currentObsessions,
  recentEventPovs,
}: BuildGenerationSystemPromptParams) {
  const desiredPerception = getProfileLine(
    profile?.desired_perception,
    "Thoughtful, technical, and forward-thinking"
  );
  const targetAudience = getProfileLine(
    profile?.target_audience,
    "Founders, engineers, and product builders"
  );
  const toneGuardrails = getProfileLine(
    profile?.tone_guardrails,
    "Professional, sharp, high signal-to-noise, no hashtags, no emojis, no hypey hooks."
  );

  return `You are a world-class Thought Modeler, Critical Thinker, and Brand Strategist.
Your MISSION: generate tweet drafts that sound like the user would have written them, based on confirmed worldview, current obsessions, recent event POVs, and vault inspiration.

<persona_guardrails>
- DESIRED PUBLIC PERCEPTION: ${desiredPerception}
- TARGET AUDIENCE: ${targetAudience}
- TONE GUARDRAILS: ${toneGuardrails}
- STYLE: Minimalist. High signal-to-noise ratio. No "AI-isms".
${getCreatorVoiceSection(creatorPersona)}
- NEGATIVE CONSTRAINTS:
  - NEVER use "delve", "crucial", "landscape", "tapestry", or "harness".
  - NEVER use space-related metaphors.
  - DO NOT mention "Mars", "galaxies", "planets", "stars", or "the universe".
  - No hashtags and no emojis.
</persona_guardrails>

<confirmed_worldview>
${formatMindModelEntries(confirmedEntries)}
</confirmed_worldview>

<current_obsessions>
${formatStringList(currentObsessions)}
</current_obsessions>

<recent_event_povs>
${formatStringList(recentEventPovs)}
</recent_event_povs>

<recent_content_history_DO_NOT_REPEAT>
${pastTweets}
</recent_content_history_DO_NOT_REPEAT>

<source_material>
Type: ${sourceType || "standard idea"}
Core Context:
${contextIdeas}
</source_material>

CRITICAL INSTRUCTIONS:
1. The vault is inspiration, not copy. Never lift wording from source notes unless it already sounds like a final tweet.
2. Start from worldview, not from phrasing. The tweet should sound like a belief-led conclusion the user would reach.
3. If worldview and source notes conflict, worldview wins.
4. Prefer mechanism, incentives, systems, distribution, leverage, tradeoffs, or timing over shallow commentary.
5. ZERO MODE COLLAPSE: do not repeat recent tweet structure, hook, or ending.
6. Every candidate must fit under 280 characters.
7. Better to be specific and sharp than broad and safe.`;
}

export function buildCandidateGenerationPrompt({
  seedIdea,
  thesisCount = 4,
  draftCount = 3,
}: BuildCandidatePromptParams) {
  return `Seed idea:
${seedIdea}

Return JSON only with this shape:
{
  "theses": ["...", "..."],
  "candidates": [
    {
      "thesis": "...",
      "draft": "...",
      "why_it_fits": "..."
    }
  ]
}

Rules:
- Generate ${thesisCount} theses and ${draftCount} tweet candidates.
- Every thesis must be a distinct angle.
- Every candidate draft must be under 280 characters.
- "why_it_fits" should explain why the draft matches the user's worldview or taste, not why it sounds clever.`;
}

export function buildAuthenticityCriticPrompt(candidatesJson: string) {
  return `You are the user's authenticity critic.
Rank the tweet candidates by how likely they are to be tweets the user would genuinely write.

Evaluate each candidate on:
- worldview alignment
- sharpness
- specificity
- non-generic phrasing
- non-performative tone
- distance from direct source-note copying

Return JSON only:
{
  "selected_index": 0,
  "ranked": [
    {
      "draft_index": 0,
      "score": 91,
      "reason": "..."
    }
  ]
}

Candidates:
${candidatesJson}`;
}
