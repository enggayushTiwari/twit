import type {
  MediaPlan,
  MindModelEntry,
  PostArchetype,
  PostFormat,
  SurfaceIntent,
} from "./self-model";
import type { StartupProfile } from "./startup";
import type {
  CompanyImageProfile,
  CommunityProfile,
  DraftKind,
  NarrativePillar,
  ProofAsset,
} from "./distribution";

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
  companyImageProfile?: CompanyImageProfile | null;
  narrativePillars?: NarrativePillar[];
  proofAssets?: ProofAsset[];
  distributionSignals?: string[];
};

type BuildCandidatePromptParams = {
  seedIdea: string;
  targetArchetype: PostArchetype;
  surfaceIntent: SurfaceIntent;
  postFormat?: PostFormat;
  thesisCount?: number;
  draftCount?: number;
  liveTopicTitle?: string | null;
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

function formatCompanyImageProfile(profile: CompanyImageProfile | null | undefined) {
  if (!profile) {
    return "None";
  }

  return [
    `Company: ${profile.company_name || "Unknown"}`,
    `Known for: ${profile.known_for || "Not set"}`,
    `Who it helps: ${profile.who_it_helps || "Not set"}`,
    `Painful problem: ${profile.painful_problem || "Not set"}`,
    `Proof points: ${profile.proof_points || "Not set"}`,
    `Objections: ${profile.objection_patterns || "Not set"}`,
    `Positioning: ${profile.positioning_statements || "Not set"}`,
    `Bio direction: ${profile.bio_direction || "Not set"}`,
    `Pinned post strategy: ${profile.pinned_post_strategy || "Not set"}`,
    `Link intent: ${profile.link_intent || "Not set"}`,
  ].join("\n");
}

function formatNarrativePillars(pillars: NarrativePillar[] | undefined) {
  if (!pillars || pillars.length === 0) {
    return "None";
  }

  return pillars
    .filter((pillar) => pillar.active !== false)
    .sort((left, right) => right.priority - left.priority)
    .map((pillar) => `${pillar.label}: ${pillar.description}`)
    .join("\n");
}

function formatProofAssets(proofAssets: ProofAsset[] | undefined) {
  if (!proofAssets || proofAssets.length === 0) {
    return "None";
  }

  return proofAssets
    .slice(0, 8)
    .map((item) => `[${item.kind}] ${item.title}: ${item.content}`)
    .join("\n");
}

function formatCommunityProfile(profile: CommunityProfile | null | undefined) {
  if (!profile) {
    return "None";
  }

  return [
    `Community: ${profile.name}`,
    `Audience focus: ${profile.audience_focus}`,
    `Description: ${profile.description || "Not set"}`,
    `Tone rules: ${profile.tone_rules || "Not set"}`,
    `Common topics: ${profile.common_topics.join(", ") || "Not set"}`,
    `Preferred post shapes: ${profile.preferred_post_shapes.join(", ") || "Not set"}`,
    `Taboo patterns: ${profile.taboo_patterns || "Not set"}`,
    `Why you belong: ${profile.why_you_belong || "Not set"}`,
  ].join("\n");
}

function getArchetypeDirective(archetype: PostArchetype) {
  switch (archetype) {
    case "question":
      return "Write like a sharp question that invites real conversation, not generic engagement bait.";
    case "hard_statement":
      return "Write like a clear, high-conviction statement with a strong point of view.";
    case "counterintuitive_take":
      return "Write like a surprising but defensible belief that reveals a deeper mechanism.";
    case "build_update":
      return "Write like a build-in-public update: what changed, what shipped, or what was learned while building.";
    case "customer_insight":
      return "Write like a customer or market insight that makes the problem or user behavior clearer.";
    case "proof_point":
      return "Write like proof: evidence, traction, concrete examples, or a credible signal.";
    case "objection_handling":
      return "Write like you are dissolving the most natural skeptical objection.";
    case "founder_belief":
      return "Write like a founder/operator belief that was earned through building, not generic advice.";
    case "trend_reaction":
      return "Write like a reaction to a current topic that reveals what you think the deeper story is.";
    case "light_humor":
      return "Write like a light, funny, knowing post that still sounds intelligent and in-character.";
    case "thread_seed":
      return "Write like the opening tweet of a thread: compact, sharp, and expandable.";
    case "disagree_cleanly":
      return "Write like a clean disagreement that adds clarity instead of heat.";
    case "add_specific_example":
      return "Write like you are adding one concrete example that makes the point stronger.";
    case "extend_with_framework":
      return "Write like you are extending the conversation with a useful framework or mechanism.";
    case "customer_pain_bridge":
      return "Write like you are connecting the conversation back to real customer pain or workflow friction.";
    case "proof_backed_response":
      return "Write like a response grounded in proof, evidence, or lived product detail.";
    case "light_witty_response":
      return "Write like a light witty response that still sounds smart and on-brand.";
    default:
      return "Write in the user's authentic voice.";
  }
}

function getSurfaceDirective(surfaceIntent: SurfaceIntent) {
  switch (surfaceIntent) {
    case "conversation_starter":
      return "Optimize for replies and discussion without sounding needy.";
    case "build_in_public":
      return "Optimize for build-in-public credibility and clarity.";
    case "news_reaction":
      return "Optimize for timely interpretation, not summary.";
    case "media_supported":
      return "Write with room for a visual or GIF to do some of the work.";
    case "thread_opener":
      return "Write like it can naturally open a longer thread.";
    case "feed_post":
    default:
      return "Optimize for standalone feed readability.";
  }
}

function getFormatDirective(postFormat: PostFormat | undefined) {
  switch (postFormat) {
    case "one_liner":
      return "Prefer a single sharp line. Compress aggressively.";
    case "question":
      return "Prefer a direct question and keep it tight.";
    case "multi_line_insight":
      return "Prefer a compact multi-line insight with clean breaks.";
    case "build_update":
      return "Prefer a readable build-update structure with clear movement.";
    case "reply_style":
      return "Prefer a conversational timeline-native style that feels like a smart reply.";
    default:
      return "Choose the shortest structure that keeps the idea sharp.";
  }
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
  companyImageProfile,
  narrativePillars,
  proofAssets,
  distributionSignals,
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
Your MISSION: generate X posts that sound like the user would have written them, based on confirmed worldview, current obsessions, recent event POVs, and vault inspiration.

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

<company_image>
${formatCompanyImageProfile(companyImageProfile)}
</company_image>

<narrative_pillars>
${formatNarrativePillars(narrativePillars)}
</narrative_pillars>

<proof_library>
${formatProofAssets(proofAssets)}
</proof_library>

<distribution_learning>
${formatStringList(distributionSignals)}
</distribution_learning>

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
5. ZERO MODE COLLAPSE: do not repeat recent post structure, hook, or ending.
6. Every candidate must fit under 280 characters.
7. Better to be specific and sharp than broad and safe.
8. Match the requested archetype and surface intent exactly instead of defaulting to generic wisdom-posting.`;
}

export function buildCandidateGenerationPrompt({
  seedIdea,
  targetArchetype,
  surfaceIntent,
  postFormat,
  thesisCount = 4,
  draftCount = 3,
  liveTopicTitle,
}: BuildCandidatePromptParams) {
  return `Seed idea:
${seedIdea}

Target post archetype: ${targetArchetype}
Target surface intent: ${surfaceIntent}
Target post format: ${postFormat || "auto"}
Archetype directive: ${getArchetypeDirective(targetArchetype)}
Surface directive: ${getSurfaceDirective(surfaceIntent)}
Format directive: ${getFormatDirective(postFormat)}
${liveTopicTitle ? `Live topic context: ${liveTopicTitle}` : ""}

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
- Single-line and single-sentence drafts are valid and often preferable for questions, hard statements, counterintuitive takes, and some proof posts.
- Match the target archetype and surface, not just the topic.
- "why_it_fits" should explain why the draft matches the user's worldview or taste, not why it sounds clever.`;
}

export function buildAuthenticityCriticPrompt(
  candidatesJson: string,
  targetArchetype: PostArchetype,
  surfaceIntent: SurfaceIntent
) {
  return `You are the user's authenticity critic.
Rank the tweet candidates by how likely they are to be tweets the user would genuinely write.

Evaluate each candidate on:
- worldview alignment
- sharpness
- specificity
- non-generic phrasing
- non-performative tone
- distance from direct source-note copying
- how well it executes the requested archetype: ${targetArchetype}
- how well it fits the requested surface intent: ${surfaceIntent}

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
  companyImageProfile?: CompanyImageProfile | null;
  narrativePillars?: NarrativePillar[];
  proofAssets?: ProofAsset[];
  distributionSignals?: string[];
};

export function buildStartupGenerationSystemPrompt({
  startupProfile,
  startupContext,
  sharedMindModel,
  startupReflections,
  recentStartupTweets,
  companyImageProfile,
  narrativePillars,
  proofAssets,
  distributionSignals,
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
Your mission is to generate build-in-public X posts about ${startupName} that make the startup legible, compelling, and human to broader people.

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

<company_image>
${formatCompanyImageProfile(companyImageProfile)}
</company_image>

<narrative_pillars>
${formatNarrativePillars(narrativePillars)}
</narrative_pillars>

<proof_library>
${formatProofAssets(proofAssets)}
</proof_library>

<distribution_learning>
${formatStringList(distributionSignals)}
</distribution_learning>

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
7. Better to make the startup understandable than to make the post ornamental.
8. Match the requested build archetype and surface intent exactly instead of defaulting to founder sermonizing.`;
}

export function buildStartupCandidateGenerationPrompt({
  seedIdea,
  targetArchetype,
  surfaceIntent,
  postFormat,
  thesisCount = 4,
  draftCount = 3,
  liveTopicTitle,
}: BuildCandidatePromptParams) {
  return `Startup memory seed:
${seedIdea}

Target post archetype: ${targetArchetype}
Target surface intent: ${surfaceIntent}
Target post format: ${postFormat || "auto"}
Archetype directive: ${getArchetypeDirective(targetArchetype)}
Surface directive: ${getSurfaceDirective(surfaceIntent)}
Format directive: ${getFormatDirective(postFormat)}
${liveTopicTitle ? `Live topic context: ${liveTopicTitle}` : ""}

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
- Single-line drafts are valid when they are sharper than a multi-line version.
- Match the target archetype and surface, not just the startup topic.
- "why_it_fits" must explain why the draft helps broader people understand the startup while still fitting the user's worldview.`;
}

export function buildStartupCriticPrompt(
  candidatesJson: string,
  targetArchetype: PostArchetype,
  surfaceIntent: SurfaceIntent
) {
  return `You are a strict startup communication critic.
Rank the tweet candidates by how likely they are to make the startup clearer, more compelling, and more authentic to the user.

Evaluate each candidate on:
- customer/public clarity
- problem-solution coherence
- audience fit
- authenticity to the user's worldview
- avoidance of unnecessary builder jargon
- usefulness for distribution
- how well it executes the requested archetype: ${targetArchetype}
- how well it fits the requested surface intent: ${surfaceIntent}

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

export function buildConversationGenerationSystemPrompt(params: {
  draftKind: DraftKind;
  conversationContext: string;
  companyImageProfile: CompanyImageProfile | null;
  communityProfile?: CommunityProfile | null;
  narrativePillars?: NarrativePillar[];
  proofAssets?: ProofAsset[];
  sharedMindModel?: MindModelEntry[];
  buildContext?: string;
  recentDistributionDrafts?: string;
  distributionSignals?: string[];
}) {
  const actionLabel = params.draftKind === "reply" ? "reply" : "quote post";

  return `You are a world-class X distribution strategist for a founder-led company.
Your mission is to write a ${actionLabel} that helps the account win qualified reach and strengthen company image.

<company_image>
${formatCompanyImageProfile(params.companyImageProfile)}
</company_image>

<community_profile>
${formatCommunityProfile(params.communityProfile)}
</community_profile>

<narrative_pillars>
${formatNarrativePillars(params.narrativePillars)}
</narrative_pillars>

<proof_library>
${formatProofAssets(params.proofAssets)}
</proof_library>

<shared_worldview>
${formatMindModelEntries(params.sharedMindModel)}
</shared_worldview>

<build_context>
${params.buildContext || "None"}
</build_context>

<recent_distribution_drafts_do_not_repeat>
${params.recentDistributionDrafts || "None"}
</recent_distribution_drafts_do_not_repeat>

<distribution_learning>
${formatStringList(params.distributionSignals)}
</distribution_learning>

<conversation_context>
${params.conversationContext}
</conversation_context>

CRITICAL INSTRUCTIONS:
1. This is a distribution asset, not a generic wisdom post.
2. Replies must feel native to the conversation and earn attention without sounding promotional.
3. Quote posts may broaden the frame, but they must still connect back to company narrative, customer pain, proof, or category point of view.
4. Do not summarize the source tweet back to the timeline.
5. Prefer clarity, specificity, and strong point of view over ornamental phrasing.
6. Keep it under 280 characters.
7. If promotion would feel forced, do not force it; earn relevance first.`;
}

export function buildCommunityOriginalGenerationSystemPrompt(params: {
  communityProfile: CommunityProfile;
  companyImageProfile: CompanyImageProfile | null;
  narrativePillars?: NarrativePillar[];
  proofAssets?: ProofAsset[];
  sharedMindModel?: MindModelEntry[];
  buildContext?: string;
  recentDistributionDrafts?: string;
  distributionSignals?: string[];
}) {
  return `You are writing a highly community-native X post for a specific audience cluster.
Your mission is to write a post that feels like it belongs inside the named community while still helping the user's company image.

<community_profile>
${formatCommunityProfile(params.communityProfile)}
</community_profile>

<company_image>
${formatCompanyImageProfile(params.companyImageProfile)}
</company_image>

<narrative_pillars>
${formatNarrativePillars(params.narrativePillars)}
</narrative_pillars>

<proof_library>
${formatProofAssets(params.proofAssets)}
</proof_library>

<shared_worldview>
${formatMindModelEntries(params.sharedMindModel)}
</shared_worldview>

<build_context>
${params.buildContext || "None"}
</build_context>

<recent_distribution_drafts_do_not_repeat>
${params.recentDistributionDrafts || "None"}
</recent_distribution_drafts_do_not_repeat>

<distribution_learning>
${formatStringList(params.distributionSignals)}
</distribution_learning>

CRITICAL INSTRUCTIONS:
1. Write for the named community, not for generic X.
2. Match the room's level of specificity, tone, and topic depth.
3. Make the user sound like they genuinely belong there.
4. Tie back to company image, product learning, customer pain, proof, or founder belief when relevant.
5. Avoid taboo patterns from the community profile.
6. Keep it under 280 characters.
7. Do not turn this into a vague motivational post.`;
}

export function buildCommunityOriginalCandidatePrompt(params: {
  communityName: string;
  topicHints: string[];
  targetArchetype: PostArchetype;
  surfaceIntent: SurfaceIntent;
  postFormat?: PostFormat;
  thesisCount?: number;
  draftCount?: number;
}) {
  return `Target community: ${params.communityName}
Topic hints: ${params.topicHints.join(", ") || "None"}
Target archetype: ${params.targetArchetype}
Target surface intent: ${params.surfaceIntent}
Target post format: ${params.postFormat || "auto"}
Archetype directive: ${getArchetypeDirective(params.targetArchetype)}
Surface directive: ${getSurfaceDirective(params.surfaceIntent)}
Format directive: ${getFormatDirective(params.postFormat)}

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
- Generate ${params.thesisCount || 3} theses and ${params.draftCount || 3} candidates.
- Each candidate must feel specific to the target community.
- Keep each draft under 280 characters.
- One-line or one-sentence drafts are valid when that matches the community's style.
- why_it_fits should explain why the post belongs in that community and still helps company image.`;
}

export function buildCommunityOriginalCriticPrompt(params: {
  candidatesJson: string;
  communityName: string;
  targetArchetype: PostArchetype;
  surfaceIntent: SurfaceIntent;
}) {
  return `You are a strict community-fit critic for X.
Rank the candidates by how likely they are to feel native, useful, and credible inside ${params.communityName}.

Evaluate each candidate on:
- native fit to the community
- specificity
- credibility
- company-image usefulness
- authenticity
- how well it executes the requested archetype: ${params.targetArchetype}
- how well it fits the requested surface intent: ${params.surfaceIntent}

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
${params.candidatesJson}`;
}

export function buildConversationCandidatePrompt(params: {
  draftKind: DraftKind;
  targetArchetype: PostArchetype;
  surfaceIntent: SurfaceIntent;
  postFormat?: PostFormat;
  conversationText: string;
  thesisCount?: number;
  draftCount?: number;
}) {
  return `Conversation seed:
${params.conversationText}

Draft kind: ${params.draftKind}
Target archetype: ${params.targetArchetype}
Target surface intent: ${params.surfaceIntent}
Target post format: ${params.postFormat || "auto"}
Archetype directive: ${getArchetypeDirective(params.targetArchetype)}
Surface directive: ${getSurfaceDirective(params.surfaceIntent)}
Format directive: ${getFormatDirective(params.postFormat)}

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
- Generate ${params.thesisCount || 3} theses and ${params.draftCount || 3} candidates.
- For replies, write as if you are directly joining the conversation.
- For quote posts, write as if you are using the source as a live prompt for your own angle.
- Do not use hashtags or emojis.
- Keep every draft under 280 characters.
- One-line replies and one-sentence quote posts are valid when they feel sharper and more native.
- why_it_fits should explain why the draft helps qualified reach and company image.`;
}

export function buildConversationCriticPrompt(params: {
  candidatesJson: string;
  draftKind: DraftKind;
  targetArchetype: PostArchetype;
  surfaceIntent: SurfaceIntent;
}) {
  return `You are a strict X distribution critic.
Rank the candidates by how likely they are to earn qualified attention while still sounding authentic.

Evaluate each candidate on:
- native fit to the conversation
- clarity
- company-image usefulness
- specificity
- authenticity
- ability to earn qualified reach
- how well it executes the requested draft kind: ${params.draftKind}
- how well it executes the requested archetype: ${params.targetArchetype}
- how well it fits the requested surface intent: ${params.surfaceIntent}

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
${params.candidatesJson}`;
}

export function buildMediaPlanPrompt(params: {
  selectedDraft: string;
  targetArchetype: PostArchetype;
  surfaceIntent: SurfaceIntent;
}) {
  return `You are a media planner for X posts.

Draft:
${params.selectedDraft}

Target archetype: ${params.targetArchetype}
Target surface intent: ${params.surfaceIntent}

Return JSON only:
{
  "media_type": "none",
  "media_reason": "...",
  "asset_brief": "...",
  "search_query": "...",
  "confidence": 0.0
}

Rules:
- Use one of: none, gif, screenshot, image, chart, short_video.
- Default to none when media would feel forced.
- GIFs are mainly for light humor or some trend reactions.
- Screenshots are mainly for build updates.
- Charts are mainly for proof points.
- Short videos are mainly for demos or motion-heavy product moments.
- Confidence must be between 0 and 1.`;
}

export function normalizeMediaPlan(value: unknown): MediaPlan {
  if (!value || typeof value !== "object") {
    return {
      media_type: "none",
      media_reason: "",
      asset_brief: "",
      search_query: "",
      confidence: 0,
    };
  }

  const plan = value as Partial<MediaPlan>;
  const mediaType = plan.media_type;
  return {
    media_type:
      mediaType === "gif" ||
      mediaType === "screenshot" ||
      mediaType === "image" ||
      mediaType === "chart" ||
      mediaType === "short_video"
        ? mediaType
        : "none",
    media_reason: String(plan.media_reason || "").trim(),
    asset_brief: String(plan.asset_brief || "").trim(),
    search_query: String(plan.search_query || "").trim(),
    confidence: Number.isFinite(Number(plan.confidence)) ? Math.max(0, Math.min(1, Number(plan.confidence))) : 0,
  };
}
