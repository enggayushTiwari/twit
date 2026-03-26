export const MIND_MODEL_KINDS = [
  "belief",
  "lens",
  "taste_like",
  "taste_avoid",
  "current_obsession",
  "open_question",
  "event_pov",
  "voice_rule",
] as const;

export const MIND_MODEL_STATUSES = [
  "suggested",
  "confirmed",
  "rejected",
  "archived",
] as const;

export const REFLECTION_MODES = [
  "capture_followup",
  "broad_reflection",
  "news_reflection",
  "draft_feedback",
] as const;

export const FEEDBACK_TAG_OPTIONS = [
  "too_generic",
  "not_my_belief",
  "bad_framing",
  "too_safe",
  "too_performative",
  "close_but_weak",
  "good",
] as const;

export const EVENT_REFLECTION_STATUSES = [
  "captured",
  "reflected",
  "archived",
] as const;

export const POST_ARCHETYPES = [
  "question",
  "hard_statement",
  "counterintuitive_take",
  "build_update",
  "customer_insight",
  "proof_point",
  "objection_handling",
  "founder_belief",
  "trend_reaction",
  "light_humor",
  "thread_seed",
  "disagree_cleanly",
  "add_specific_example",
  "extend_with_framework",
  "customer_pain_bridge",
  "proof_backed_response",
  "light_witty_response",
] as const;

export const SURFACE_INTENTS = [
  "feed_post",
  "conversation_starter",
  "build_in_public",
  "news_reaction",
  "media_supported",
  "thread_opener",
] as const;

export const POST_FORMATS = [
  "one_liner",
  "question",
  "multi_line_insight",
  "build_update",
  "reply_style",
] as const;

export const MEDIA_TYPES = [
  "none",
  "gif",
  "screenshot",
  "image",
  "chart",
  "short_video",
] as const;

export const SOURCE_MEMORY_SCOPES = ["general", "build", "mixed"] as const;

export type MindModelKind = (typeof MIND_MODEL_KINDS)[number];
export type MindModelStatus = (typeof MIND_MODEL_STATUSES)[number];
export type ReflectionMode = (typeof REFLECTION_MODES)[number];
export type FeedbackTag = (typeof FEEDBACK_TAG_OPTIONS)[number];
export type EventReflectionStatus = (typeof EVENT_REFLECTION_STATUSES)[number];
export type PostArchetype = (typeof POST_ARCHETYPES)[number];
export type SurfaceIntent = (typeof SURFACE_INTENTS)[number];
export type PostFormat = (typeof POST_FORMATS)[number];
export type MediaType = (typeof MEDIA_TYPES)[number];
export type SourceMemoryScope = (typeof SOURCE_MEMORY_SCOPES)[number];
export type ReflectionFormat = "open" | "pairwise";

export type MindModelEntry = {
  id: string;
  kind: MindModelKind;
  statement: string;
  status: MindModelStatus;
  confidence: number;
  priority: number;
  source_type: string;
  source_ref_id: string | null;
  tags: string[] | null;
  evidence_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type ReflectionMetadata = {
  format?: ReflectionFormat;
  options?: string[];
  rationale?: string;
  stage?: "take" | "broader" | "reflect";
  event_reflection_id?: string;
};

export type ReflectionTurn = {
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

export type DraftFeedbackRecord = {
  id: string;
  generated_tweet_id: string;
  decision: string;
  original_content: string;
  edited_content: string | null;
  feedback_tags: string[] | null;
  freeform_note: string | null;
  created_at: string;
};

export type EventReflection = {
  id: string;
  headline: string;
  source_url: string | null;
  source_summary: string;
  user_take: string | null;
  derived_thesis: string | null;
  status: EventReflectionStatus;
  created_at: string;
};

export type TweetAlternate = {
  draft: string;
  thesis: string;
  why_it_fits: string;
  score?: number;
};

export type MediaPlan = {
  media_type: MediaType;
  media_reason: string;
  asset_brief: string;
  search_query: string;
  confidence: number;
  generated_image_prompt?: string;
};

export type GeneratedTweetRecord = {
  id: string;
  content: string;
  status: string;
  created_at: string;
  generation_mode?: "general" | "build" | "startup";
  draft_kind?: "original_post" | "reply" | "quote_post";
  post_format?: PostFormat | null;
  pillar_label?: string | null;
  source_conversation_id?: string | null;
  community_profile_id?: string | null;
  community_label?: string | null;
  theses?: string[] | null;
  alternates?: TweetAlternate[] | null;
  rationale?: string | null;
  post_archetype?: PostArchetype | null;
  surface_intent?: SurfaceIntent | null;
  media_plan?: MediaPlan | null;
  source_memory_scope?: SourceMemoryScope | null;
};

export type SuggestedMindModelEntry = {
  kind: MindModelKind;
  statement: string;
  confidence: number;
  priority: number;
  tags?: string[];
  evidence_summary?: string;
};

export type CaptureExtractionResult = {
  signal_type:
    | "observation"
    | "belief"
    | "frustration"
    | "principle"
    | "question"
    | "event_reaction";
  distribution_classification:
    | "company_narrative"
    | "customer_pain"
    | "proof"
    | "build_update"
    | "reply_seed"
    | "trend_reaction"
    | "private_thought";
  x_eligible: boolean;
  suggested_pillar: string;
  distribution_reason: string;
  should_ask_follow_up: boolean;
  follow_up_question: string;
  candidate_entries: SuggestedMindModelEntry[];
};

export type BroadReflectionPrompt = {
  prompt: string;
  format: ReflectionFormat;
  options?: string[];
  rationale?: string;
};

export type GenerationCandidate = {
  thesis: string;
  draft: string;
  why_it_fits: string;
};

export type GenerationDraftSet = {
  theses: string[];
  candidates: GenerationCandidate[];
};

export type RankedGenerationResult = {
  selected_index: number;
  ranked: Array<{
    draft_index: number;
    score: number;
    reason: string;
  }>;
};

export function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

export function normalizeReflectionMetadata(value: unknown): ReflectionMetadata {
  if (!value || typeof value !== "object") {
    return {};
  }

  const metadata = value as ReflectionMetadata;
  return {
    format: metadata.format === "pairwise" ? "pairwise" : "open",
    options: normalizeStringArray(metadata.options),
    rationale: metadata.rationale || "",
    stage:
      metadata.stage === "take" || metadata.stage === "broader"
        ? metadata.stage
        : "reflect",
    event_reflection_id: metadata.event_reflection_id || undefined,
  };
}

export function shouldTriggerBroadReflection(params: {
  newIdeaCount: number;
  lastBroadReflectionAt: string | null;
  unresolvedOpenQuestionCount: number;
  now?: Date;
}) {
  const { newIdeaCount, lastBroadReflectionAt, unresolvedOpenQuestionCount } = params;
  const now = params.now || new Date();

  if (newIdeaCount >= 5) {
    return true;
  }

  if (!lastBroadReflectionAt) {
    return unresolvedOpenQuestionCount > 0;
  }

  const lastDate = new Date(lastBroadReflectionAt);
  const daysSinceLast = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSinceLast >= 7 && unresolvedOpenQuestionCount > 0;
}

export function calculateEditIntensity(originalContent: string, editedContent: string) {
  if (!originalContent.trim() && !editedContent.trim()) {
    return 0;
  }

  const originalWords = originalContent.trim().split(/\s+/).filter(Boolean);
  const editedWords = editedContent.trim().split(/\s+/).filter(Boolean);
  const maxLength = Math.max(originalWords.length, editedWords.length, 1);
  let differences = 0;

  for (let index = 0; index < maxLength; index += 1) {
    if (originalWords[index] !== editedWords[index]) {
      differences += 1;
    }
  }

  return differences / maxLength;
}

export function buildFeedbackSuggestion(tag: FeedbackTag): SuggestedMindModelEntry | null {
  switch (tag) {
    case "too_generic":
      return {
        kind: "taste_avoid",
        statement: "Avoid generic inspirational framing that lacks a sharp mechanism or specific thesis.",
        confidence: 0.65,
        priority: 2,
        tags: ["feedback", "specificity"],
        evidence_summary: "Repeated review feedback indicates the user rejects generic framing.",
      };
    case "not_my_belief":
      return {
        kind: "voice_rule",
        statement: "Do not generate claims that overstate conviction unless they clearly align with the user's confirmed worldview.",
        confidence: 0.7,
        priority: 3,
        tags: ["feedback", "authenticity"],
        evidence_summary: "Repeated review feedback indicates the user rejects drafts that imply beliefs they do not hold.",
      };
    case "bad_framing":
      return {
        kind: "taste_avoid",
        statement: "Avoid the wrong lens; favor mechanism, systems, or incentives over shallow framing.",
        confidence: 0.65,
        priority: 2,
        tags: ["feedback", "framing"],
        evidence_summary: "Repeated review feedback indicates the user dislikes the framing more than the core idea.",
      };
    case "too_safe":
      return {
        kind: "voice_rule",
        statement: "Prefer sharper, more opinionated claims over consensus-safe observations.",
        confidence: 0.68,
        priority: 2,
        tags: ["feedback", "sharpness"],
        evidence_summary: "Repeated review feedback indicates the user wants stronger conviction.",
      };
    case "too_performative":
      return {
        kind: "taste_avoid",
        statement: "Avoid performative internet voice and over-designed punchlines.",
        confidence: 0.7,
        priority: 3,
        tags: ["feedback", "tone"],
        evidence_summary: "Repeated review feedback indicates the user rejects performative tone.",
      };
    case "close_but_weak":
      return {
        kind: "voice_rule",
        statement: "When a draft is close, sharpen the core claim and compress the phrasing rather than changing the topic.",
        confidence: 0.62,
        priority: 2,
        tags: ["feedback", "editing"],
        evidence_summary: "Repeated review feedback indicates the user often wants sharper versions of nearby ideas.",
      };
    case "good":
      return {
        kind: "taste_like",
        statement: "Lean toward concise, high-signal drafts that make one precise claim cleanly.",
        confidence: 0.62,
        priority: 1,
        tags: ["feedback", "positive"],
        evidence_summary: "Positive review feedback indicates this general style matches the user's taste.",
      };
    default:
      return null;
  }
}

export function getFeedbackTagLabel(tag: FeedbackTag) {
  switch (tag) {
    case "too_generic":
      return "Too generic";
    case "not_my_belief":
      return "Not my belief";
    case "bad_framing":
      return "Bad framing";
    case "too_safe":
      return "Too safe";
    case "too_performative":
      return "Too performative";
    case "close_but_weak":
      return "Close but weak";
    case "good":
      return "Good";
    default:
      return tag;
  }
}

export function groupMindModelEntries(entries: MindModelEntry[]) {
  const sections = {
    confirmedBeliefs: [] as MindModelEntry[],
    recurringLenses: [] as MindModelEntry[],
    tasteLikes: [] as MindModelEntry[],
    tasteAvoids: [] as MindModelEntry[],
    currentObsessions: [] as MindModelEntry[],
    openQuestions: [] as MindModelEntry[],
    recentEventPovs: [] as MindModelEntry[],
    suggestedEntries: [] as MindModelEntry[],
    voiceRules: [] as MindModelEntry[],
  };

  for (const entry of entries) {
    if (entry.status === "suggested") {
      sections.suggestedEntries.push(entry);
      continue;
    }

    switch (entry.kind) {
      case "belief":
        sections.confirmedBeliefs.push(entry);
        break;
      case "lens":
        sections.recurringLenses.push(entry);
        break;
      case "taste_like":
        sections.tasteLikes.push(entry);
        break;
      case "taste_avoid":
        sections.tasteAvoids.push(entry);
        break;
      case "current_obsession":
        sections.currentObsessions.push(entry);
        break;
      case "open_question":
        sections.openQuestions.push(entry);
        break;
      case "event_pov":
        sections.recentEventPovs.push(entry);
        break;
      case "voice_rule":
        sections.voiceRules.push(entry);
        break;
      default:
        break;
    }
  }

  return sections;
}
