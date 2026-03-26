import type { PostArchetype, SurfaceIntent } from "./self-model";
import type { GeneratedTweetMode } from "./startup";
import type { DiscoveryTopicId } from "./discovery-config";

export type RecentGeneratedPost = {
  post_archetype?: PostArchetype | null;
  surface_intent?: SurfaceIntent | null;
  created_at?: string;
};

export type Daypart = "morning" | "afternoon" | "evening";

const GENERAL_ARCHETYPES: PostArchetype[] = [
  "question",
  "hard_statement",
  "counterintuitive_take",
  "proof_point",
  "trend_reaction",
  "light_humor",
  "thread_seed",
];

const BUILD_ARCHETYPES: PostArchetype[] = [
  "build_update",
  "customer_insight",
  "proof_point",
  "objection_handling",
  "founder_belief" as PostArchetype,
  "trend_reaction",
  "light_humor",
  "thread_seed",
];

const DAYPART_PREFERENCES: Record<Daypart, PostArchetype[]> = {
  morning: ["question", "hard_statement", "counterintuitive_take", "proof_point"],
  afternoon: ["build_update", "customer_insight", "objection_handling", "proof_point"],
  evening: ["trend_reaction", "light_humor", "thread_seed", "build_update"],
};

export function getDaypartBucket(now = new Date()): Daypart {
  const hour = now.getHours();
  if (hour < 12) {
    return "morning";
  }

  if (hour < 18) {
    return "afternoon";
  }

  return "evening";
}

export function getAllowedArchetypes(mode: GeneratedTweetMode): PostArchetype[] {
  return mode === "general" ? GENERAL_ARCHETYPES : BUILD_ARCHETYPES;
}

export function getSurfaceIntentForArchetype(archetype: PostArchetype): SurfaceIntent {
  switch (archetype) {
    case "question":
      return "conversation_starter";
    case "build_update":
    case "customer_insight":
    case "objection_handling":
    case "founder_belief":
      return "build_in_public";
    case "trend_reaction":
      return "news_reaction";
    case "light_humor":
    case "proof_point":
      return "media_supported";
    case "thread_seed":
      return "thread_opener";
    default:
      return "feed_post";
  }
}

export function choosePostPlan(params: {
  mode: GeneratedTweetMode;
  recentPosts: RecentGeneratedPost[];
  hasLiveTopic: boolean;
  now?: Date;
}) {
  const now = params.now || new Date();
  const daypart = getDaypartBucket(now);
  const recent = params.recentPosts.slice(0, 20);
  const recentArchetypes = recent.map((post) => post.post_archetype).filter(Boolean) as PostArchetype[];
  const recentCounts = new Map<PostArchetype, number>();

  for (const archetype of recentArchetypes) {
    recentCounts.set(archetype, (recentCounts.get(archetype) || 0) + 1);
  }

  const lastArchetype = recentArchetypes[0] || null;
  const lastSurface =
    recent.map((post) => post.surface_intent).filter(Boolean)[0] || null;
  const recentTrendCount = recentArchetypes.slice(0, 4).filter((item) => item === "trend_reaction").length;
  const preferred = new Set(DAYPART_PREFERENCES[daypart]);

  const candidates = getAllowedArchetypes(params.mode).filter((archetype) => {
    if (!params.hasLiveTopic && archetype === "trend_reaction") {
      return false;
    }

    if (archetype === "trend_reaction" && recentTrendCount >= 1) {
      return false;
    }

    return archetype !== lastArchetype;
  });

  const scored = (candidates.length > 0 ? candidates : getAllowedArchetypes(params.mode))
    .map((archetype) => {
      const count = recentCounts.get(archetype) || 0;
      const surfaceIntent = getSurfaceIntentForArchetype(archetype);
      let score = 10 - count * 2;

      if (preferred.has(archetype)) {
        score += 4;
      }

      if (count === 0) {
        score += 2;
      }

      if (surfaceIntent === lastSurface) {
        score -= 1.5;
      }

      if (params.mode !== "general" && archetype === "build_update") {
        score += 1;
      }

      return { archetype, surfaceIntent, score };
    })
    .sort((left, right) => right.score - left.score || left.archetype.localeCompare(right.archetype));

  const selected = scored[0];

  return {
    archetype: selected?.archetype || getAllowedArchetypes(params.mode)[0],
    surfaceIntent: selected?.surfaceIntent || "feed_post",
    daypart,
  };
}

export function recommendTopicArchetype(params: {
  kind: "news" | "x_trend";
  topic: DiscoveryTopicId;
  title: string;
}) {
  let archetype: PostArchetype = params.kind === "x_trend" ? "trend_reaction" : "counterintuitive_take";
  let worldviewFitScore = 0.55;
  let buildRelevanceScore = 0.4;
  let postabilityScore = 0.6;

  if (params.topic === "startups" || params.topic === "technology" || params.topic === "ai") {
    archetype = "trend_reaction";
    buildRelevanceScore = 0.8;
  } else if (params.topic === "business" || params.topic === "finance") {
    archetype = "hard_statement";
    worldviewFitScore = 0.72;
  } else if (params.topic === "policy") {
    archetype = "question";
    worldviewFitScore = 0.7;
  }

  if (params.kind === "x_trend") {
    postabilityScore += 0.08;
  }

  if (/launch|ship|release|funding|feature|product/i.test(params.title)) {
    buildRelevanceScore = Math.max(buildRelevanceScore, 0.82);
  }

  return {
    recommendedArchetype: archetype,
    worldviewFitScore,
    buildRelevanceScore,
    postabilityScore,
  };
}
