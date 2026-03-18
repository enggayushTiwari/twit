export type CreatorPersonaRecord = {
  handle: string;
  ai_voice_profile: string;
} | null;

export type UserProfileRecord = {
  desired_perception?: string | null;
  target_audience?: string | null;
  tone_guardrails?: string | null;
} | null;

type BuildGenerationPromptParams = {
  profile: UserProfileRecord;
  creatorPersona: CreatorPersonaRecord;
  sourceType?: string | null;
  contextIdeas: string;
  pastTweets: string;
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

export function buildGenerationSystemPrompt({
  profile,
  creatorPersona,
  sourceType,
  contextIdeas,
  pastTweets,
}: BuildGenerationPromptParams) {
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

  return `You are a world-class Critical Thinker and Brand Strategist.
Your MISSION: Analyze the provided source material, extract the core philosophical or technical thesis, and craft a single, high-performance tweet that offers a fresh, original perspective.

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

<recent_content_history_DO_NOT_REPEAT>
${pastTweets}
</recent_content_history_DO_NOT_REPEAT>

<source_material>
Type: ${sourceType || "standard idea"}
Core Context:
${contextIdeas}
</source_material>

CRITICAL INSTRUCTIONS:
1. ANALYSIS FIRST: Identify the primary insight in the <source_material>. Do not just rephrase it; synthesize it.
2. ZERO MODE COLLAPSE: You must NEVER reuse the exact phrasing, hook, or ending from the <recent_content_history_DO_NOT_REPEAT>. If your drafted tweet looks similar to history, delete it and start over.
3. ORIGINALITY: Focus on systems, startups, and distribution. If the idea is philosophical, apply it to modern building or engineering.
4. VOICE PRIORITY: The user's explicit profile beats the reference voice. The reference voice is optional seasoning, not the identity.
5. BREVITY: Absolute maximum of 280 characters. If it exceeds this limit, it is a failure. Be punchy.`;
}
