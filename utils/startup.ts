import type { ReflectionFormat } from "./self-model";

export const BUILD_MEMORY_KINDS = [
  "product_insight",
  "customer_pain",
  "positioning",
  "objection",
  "proof",
  "shipping_update",
  "distribution_gtm",
  "founder_belief",
  "user_language",
  "project_log",
] as const;

export const STARTUP_MEMORY_KINDS = BUILD_MEMORY_KINDS;

export const BUILD_REFLECTION_MODES = ["capture_followup"] as const;

export const STARTUP_REFLECTION_MODES = BUILD_REFLECTION_MODES;

export const GENERATED_TWEET_MODES = ["general", "build", "startup"] as const;

export type BuildMemoryKind = (typeof BUILD_MEMORY_KINDS)[number];
export type StartupMemoryKind = BuildMemoryKind;
export type BuildReflectionMode = (typeof BUILD_REFLECTION_MODES)[number];
export type StartupReflectionMode = BuildReflectionMode;
export type GeneratedTweetMode = (typeof GENERATED_TWEET_MODES)[number];

export type StartupProfile = {
  id: string;
  startup_name: string;
  one_liner: string;
  target_customer: string;
  painful_problem: string;
  transformation: string;
  positioning: string;
  proof_points: string;
  objections: string;
  language_guardrails: string;
  updated_at: string;
};

export type StartupMemoryMetadata = {
  communication_focus?: string;
  suggested_points?: string[];
  follow_up_answer?: string;
};

export type StartupMemoryEntry = {
  id: string;
  content: string;
  kind: StartupMemoryKind;
  metadata: StartupMemoryMetadata | null;
  created_at: string;
};

export type StartupReflectionMetadata = {
  format?: ReflectionFormat;
  rationale?: string;
  suggestions?: string[];
  focus?: string;
};

export type StartupReflectionTurn = {
  id: string;
  mode: StartupReflectionMode;
  prompt: string;
  answer: string;
  startup_memory_entry_id: string | null;
  metadata: StartupReflectionMetadata | null;
  created_at: string;
};

export type StartupCaptureSuggestion = {
  communication_focus: string;
  suggested_points: string[];
  should_ask_follow_up: boolean;
  follow_up_question: string;
};

export function isStartupMemoryKind(value: string): value is StartupMemoryKind {
  return (STARTUP_MEMORY_KINDS as readonly string[]).includes(value);
}

export function normalizeStartupSuggestions(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

export function normalizeStartupMetadata(value: unknown): StartupMemoryMetadata {
  if (!value || typeof value !== "object") {
    return {};
  }

  const metadata = value as StartupMemoryMetadata;
  return {
    communication_focus: metadata.communication_focus?.trim() || "",
    suggested_points: normalizeStartupSuggestions(metadata.suggested_points),
    follow_up_answer: metadata.follow_up_answer?.trim() || "",
  };
}

export function normalizeStartupReflectionMetadata(value: unknown): StartupReflectionMetadata {
  if (!value || typeof value !== "object") {
    return {};
  }

  const metadata = value as StartupReflectionMetadata;
  return {
    format: metadata.format === "pairwise" ? "pairwise" : "open",
    rationale: metadata.rationale?.trim() || "",
    suggestions: normalizeStartupSuggestions(metadata.suggestions),
    focus: metadata.focus?.trim() || "",
  };
}

export function getStartupMemoryKindLabel(kind: StartupMemoryKind) {
  switch (kind) {
    case "product_insight":
      return "Product insight";
    case "customer_pain":
      return "Customer pain";
    case "positioning":
      return "Positioning";
    case "objection":
      return "Objection";
    case "proof":
      return "Proof";
    case "shipping_update":
      return "Shipping update";
    case "distribution_gtm":
      return "Distribution / GTM";
    case "founder_belief":
      return "Founder belief";
    case "user_language":
      return "User language";
    case "project_log":
      return "Project log";
    default:
      return kind;
  }
}
