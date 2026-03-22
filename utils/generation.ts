import type { MindModelEntry } from "./self-model";
import type { StartupProfile } from "./startup";

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

type BuildStartupGenerationSystemPromptParams = {
  startupProfile: StartupProfile | null;
  startupContext: string;
  sharedMindModel?: MindModelEntry[];
  startupReflections?: string[];
  recentStartupTweets?: string;
};

export function buildStartupGenerationSystemPrompt({
  startupProfile,
  startupContext,
  sharedMindModel,
  startupReflections,
  recentStartupTweets,
}: BuildStartupGenerationSystemPromptParams) {
  const startupName = getProfileLine(startupProfile?.startup_name, "the user's startup");
  const oneLiner = getProfileLine(
    startupProfile?.one_liner,
    "A startup the user is still sharpening for clearer public communication."
  );
  const targetCustomer = getProfileLine(
    startupProfile?.target_customer,
    "Customers or broader people who need the product explained clearly."
  );
  const painfulProblem = getProfileLine(
    startupProfile?.painful_problem,
    "The product solves a painful but still under-explained problem."
  );
  const transformation = getProfileLine(
    startupProfile?.transformation,
    "Explain what changes for the user after adopting the product."
  );
  const positioning = getProfileLine(
    startupProfile?.positioning,
    "Position the startup in plain language before using insider jargon."
  );
  const proofPoints = getProfileLine(
    startupProfile?.proof_points,
    "Use proof sparingly but concretely when it exists."
  );
  const objections = getProfileLine(
    startupProfile?.objections,
    "Surface the skeptical question an outsider would naturally ask."
  );
  const languageGuardrails = getProfileLine(
    startupProfile?.language_guardrails,
    "Prefer customer language, plain talk, and explainability over founder jargon."
  );

  return `You are a world-class startup communicator and thought partner.
Your mission is to generate tweets about ${startupName} that make the startup legible, compelling, and human to broader people.

<startup_profile>
- STARTUP: ${startupName}
- ONE LINER: ${oneLiner}
- TARGET CUSTOMER: ${targetCustomer}
- PAINFUL PROBLEM: ${painfulProblem}
- TRANSFORMATION: ${transformation}
- POSITIONING: ${positioning}
- PROOF: ${proofPoints}
- OBJECTIONS: ${objections}
- LANGUAGE GUARDRAILS: ${languageGuardrails}
</startup_profile>

<shared_worldview>
${formatMindModelEntries(sharedMindModel)}
</shared_worldview>

<startup_reflections>
${formatStringList(startupReflections)}
</startup_reflections>

<recent_startup_tweets_do_not_repeat>
${recentStartupTweets || "None"}
</recent_startup_tweets_do_not_repeat>

<startup_memory>
${startupContext}
</startup_memory>

CRITICAL INSTRUCTIONS:
1. This is not the general thought generator. Write specifically about the startup.
2. Optimize for customers/public first. Explain clearly before sounding clever.
3. Prefer problem-solution, stakes, misunderstanding, proof, objection-handling, and concrete transformation.
4. Use the shared worldview only as a taste and reasoning filter. Do not pull in unrelated general-vault ideas.
5. Avoid builder jargon unless it is necessary and then explain it.
6. Every draft must fit under 280 characters.
7. Better to make the startup understandable than to make the tweet ornamental.`;
}

export function buildStartupCandidateGenerationPrompt({
  seedIdea,
  thesisCount = 4,
  draftCount = 3,
}: BuildCandidatePromptParams) {
  return `Startup memory seed:
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
- Favor distinct startup communication angles such as problem clarity, customer transformation, objection handling, proof, and positioning.
- Every draft must be under 280 characters.
- "why_it_fits" must explain why the draft helps broader people understand the startup while still fitting the user's worldview.`;
}

export function buildStartupCriticPrompt(candidatesJson: string) {
  return `You are a strict startup communication critic.
Rank the tweet candidates by how likely they are to make the startup clearer, more compelling, and more authentic to the user.

Evaluate each candidate on:
- customer/public clarity
- problem-solution coherence
- audience fit
- authenticity to the user's worldview
- avoidance of unnecessary builder jargon
- usefulness for distribution

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
