import type { PostArchetype } from './self-model';

export const DISTRIBUTION_CLASSIFICATIONS = [
  'company_narrative',
  'customer_pain',
  'proof',
  'build_update',
  'reply_seed',
  'trend_reaction',
  'private_thought',
] as const;

export const DRAFT_KINDS = ['original_post', 'reply', 'quote_post'] as const;
export const COMMUNITY_AUDIENCE_FOCUSES = ['builders', 'customers', 'mixed'] as const;

export const CONVERSATION_RECOMMENDED_ACTIONS = [
  'reply',
  'quote',
  'ignore',
  'save_as_event',
] as const;

export const CONVERSATION_SOURCE_TYPES = [
  'tweet_url',
  'search_url',
  'profile_url',
  'manual_paste',
  'thread_text',
] as const;

export const CONVERSATION_STATUSES = ['new', 'used', 'ignored', 'saved_as_event'] as const;

export const PROOF_ASSET_KINDS = [
  'screenshot',
  'demo',
  'metric',
  'customer_quote',
  'product_change',
] as const;

export const OUTCOME_KINDS = [
  'opened_in_x',
  'posted_manually',
  'discarded',
  'performance_update',
] as const;

export type DistributionClassification = (typeof DISTRIBUTION_CLASSIFICATIONS)[number];
export type DraftKind = (typeof DRAFT_KINDS)[number];
export type CommunityAudienceFocus = (typeof COMMUNITY_AUDIENCE_FOCUSES)[number];
export type ConversationRecommendedAction = (typeof CONVERSATION_RECOMMENDED_ACTIONS)[number];
export type ConversationSourceType = (typeof CONVERSATION_SOURCE_TYPES)[number];
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
export type ProofAssetKind = (typeof PROOF_ASSET_KINDS)[number];
export type OutcomeKind = (typeof OUTCOME_KINDS)[number];

export type CompanyImageProfile = {
  id: string;
  company_name: string;
  known_for: string;
  who_it_helps: string;
  painful_problem: string;
  proof_points: string;
  objection_patterns: string;
  positioning_statements: string;
  bio_direction: string;
  header_concept: string;
  pinned_post_strategy: string;
  link_intent: string;
  updated_at: string;
};

export type NarrativePillar = {
  id: string;
  label: string;
  description: string;
  priority: number;
  active: boolean;
  created_at: string;
};

export type CommunityProfile = {
  id: string;
  name: string;
  slug: string;
  description: string;
  audience_focus: CommunityAudienceFocus;
  tone_rules: string;
  common_topics: string[];
  preferred_post_shapes: string[];
  taboo_patterns: string;
  why_you_belong: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProofAsset = {
  id: string;
  kind: ProofAssetKind;
  title: string;
  content: string;
  asset_url: string | null;
  proof_strength: number;
  created_at: string;
};

export type TargetAccount = {
  id: string;
  handle: string;
  display_name: string;
  reason: string;
  priority: number;
  monitoring_notes: string;
  created_at: string;
};

export type ConversationOpportunity = {
  id: string;
  source_type: ConversationSourceType;
  source_url: string | null;
  community_profile_id: string | null;
  community_label: string | null;
  author_handle: string | null;
  author_name: string | null;
  content: string;
  topic_tags: string[];
  why_it_matters: string;
  recommended_action: ConversationRecommendedAction;
  status: ConversationStatus;
  raw_input: string;
  created_at: string;
};

export type DistributionOutcome = {
  id: string;
  generated_tweet_id: string;
  outcome_kind: OutcomeKind;
  impressions: number | null;
  likes: number | null;
  replies: number | null;
  reposts: number | null;
  bookmarks: number | null;
  profile_visits: number | null;
  follows_gained: number | null;
  link_clicks: number | null;
  notes: string | null;
  created_at: string;
};

export function isDistributionClassification(value: string): value is DistributionClassification {
  return (DISTRIBUTION_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function isDraftKind(value: string): value is DraftKind {
  return (DRAFT_KINDS as readonly string[]).includes(value);
}

export function isCommunityAudienceFocus(value: string): value is CommunityAudienceFocus {
  return (COMMUNITY_AUDIENCE_FOCUSES as readonly string[]).includes(value);
}

export function isConversationRecommendedAction(
  value: string
): value is ConversationRecommendedAction {
  return (CONVERSATION_RECOMMENDED_ACTIONS as readonly string[]).includes(value);
}

export function isConversationSourceType(value: string): value is ConversationSourceType {
  return (CONVERSATION_SOURCE_TYPES as readonly string[]).includes(value);
}

export function isConversationStatus(value: string): value is ConversationStatus {
  return (CONVERSATION_STATUSES as readonly string[]).includes(value);
}

export function isProofAssetKind(value: string): value is ProofAssetKind {
  return (PROOF_ASSET_KINDS as readonly string[]).includes(value);
}

export function isOutcomeKind(value: string): value is OutcomeKind {
  return (OUTCOME_KINDS as readonly string[]).includes(value);
}

export function normalizeDistributionClassification(
  value: unknown,
  fallback: DistributionClassification = 'private_thought'
) {
  return typeof value === 'string' && isDistributionClassification(value) ? value : fallback;
}

export function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(String).map((item) => item.trim()).filter(Boolean);
}

export function slugifyCommunityName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function isXEligibleClassification(classification: DistributionClassification) {
  return classification !== 'private_thought';
}

export function getDefaultNarrativePillars() {
  return [
    {
      label: 'Company vision',
      description: 'What the company believes should change and why its category matters.',
      priority: 3,
    },
    {
      label: 'Customer pain',
      description: 'The painful reality the customer is stuck in before the product.',
      priority: 3,
    },
    {
      label: 'Build/progress',
      description: 'What is shipping, changing, or being learned in public while building.',
      priority: 2,
    },
    {
      label: 'Proof/results',
      description: 'Concrete evidence, demos, usage, metrics, and customer proof.',
      priority: 3,
    },
    {
      label: 'Category POV',
      description: 'How the company sees the market, product category, and broader shifts.',
      priority: 2,
    },
  ];
}

export function getDistributionClassificationLabel(classification: DistributionClassification) {
  switch (classification) {
    case 'company_narrative':
      return 'Company narrative';
    case 'customer_pain':
      return 'Customer pain';
    case 'proof':
      return 'Proof';
    case 'build_update':
      return 'Build update';
    case 'reply_seed':
      return 'Reply seed';
    case 'trend_reaction':
      return 'Trend reaction';
    case 'private_thought':
      return 'Private thought';
    default:
      return classification;
  }
}

export function getDraftKindLabel(kind: DraftKind) {
  switch (kind) {
    case 'original_post':
      return 'Original post';
    case 'reply':
      return 'Reply';
    case 'quote_post':
      return 'Quote post';
    default:
      return kind;
  }
}

export function getCommunityAudienceLabel(focus: CommunityAudienceFocus) {
  switch (focus) {
    case 'builders':
      return 'Builders';
    case 'customers':
      return 'Customers';
    case 'mixed':
      return 'Mixed audience';
    default:
      return focus;
  }
}

export function getConversationActionLabel(action: ConversationRecommendedAction) {
  switch (action) {
    case 'reply':
      return 'Reply';
    case 'quote':
      return 'Quote';
    case 'ignore':
      return 'Ignore';
    case 'save_as_event':
      return 'Save as event';
    default:
      return action;
  }
}

export function getProofAssetKindLabel(kind: ProofAssetKind) {
  switch (kind) {
    case 'screenshot':
      return 'Screenshot';
    case 'demo':
      return 'Demo';
    case 'metric':
      return 'Metric';
    case 'customer_quote':
      return 'Customer quote';
    case 'product_change':
      return 'Product change';
    default:
      return kind;
  }
}

export function inferPillarLabel(params: {
  classification?: DistributionClassification | null;
  content?: string | null;
  availablePillars?: Array<{ label: string }>;
}) {
  const content = `${params.content || ''}`.toLowerCase();
  const available = (params.availablePillars || []).map((pillar) => pillar.label.toLowerCase());

  const choose = (desired: string, fallback: string) =>
    available.find((label) => label === desired.toLowerCase()) || fallback;

  switch (params.classification) {
    case 'customer_pain':
      return choose('Customer pain', 'Customer pain');
    case 'proof':
      return choose('Proof/results', 'Proof/results');
    case 'build_update':
      return choose('Build/progress', 'Build/progress');
    case 'trend_reaction':
      return choose('Category POV', 'Category POV');
    case 'company_narrative':
      return choose('Company vision', 'Company vision');
    default:
      break;
  }

  if (/\b(metric|usage|customer|revenue|retention|proof|result)\b/.test(content)) {
    return choose('Proof/results', 'Proof/results');
  }
  if (/\b(ship|shipped|launch|building|release|feature|progress)\b/.test(content)) {
    return choose('Build/progress', 'Build/progress');
  }
  if (/\b(customer|pain|problem|friction|workflow)\b/.test(content)) {
    return choose('Customer pain', 'Customer pain');
  }

  return choose('Category POV', 'Category POV');
}

export function chooseConversationArchetype(params: {
  draftKind: DraftKind;
  recommendedAction: ConversationRecommendedAction;
  content: string;
  recentArchetypes?: Array<PostArchetype | null | undefined>;
}): PostArchetype {
  const recent = (params.recentArchetypes || []).filter(Boolean) as PostArchetype[];
  const content = params.content.toLowerCase();

  const candidates: PostArchetype[] =
    params.draftKind === 'reply'
      ? [
          'add_specific_example',
          'extend_with_framework',
          'proof_backed_response',
          'customer_pain_bridge',
          'disagree_cleanly',
          'light_witty_response',
        ]
      : [
          'trend_reaction',
          'counterintuitive_take',
          'customer_pain_bridge',
          'proof_backed_response',
          'extend_with_framework',
          'light_witty_response',
        ];

  let preferred: PostArchetype = candidates[0];

  if (/\bwrong|disagree|misread|false|bullshit\b/.test(content)) {
    preferred = 'disagree_cleanly';
  } else if (/\bexample|customer|workflow|pain|friction\b/.test(content)) {
    preferred = 'customer_pain_bridge';
  } else if (/\bmetric|number|data|proof|revenue|usage|result\b/.test(content)) {
    preferred = 'proof_backed_response';
  } else if (/\bwhy|because|framework|system|incentive|pattern\b/.test(content)) {
    preferred = 'extend_with_framework';
  } else if (/\bfunny|lol|meme|joke\b/.test(content)) {
    preferred = 'light_witty_response';
  } else if (params.draftKind === 'quote_post' || params.recommendedAction === 'quote') {
    preferred = 'trend_reaction';
  }

  if (!recent.includes(preferred)) {
    return preferred;
  }

  const alternative = candidates.find((archetype) => !recent.includes(archetype));
  return alternative || preferred;
}

export function chooseCommunityPostArchetype(params: {
  contentHints?: string[];
  recentArchetypes?: Array<PostArchetype | null | undefined>;
}) {
  const recent = (params.recentArchetypes || []).filter(Boolean) as PostArchetype[];
  const content = (params.contentHints || []).join(' ').toLowerCase();
  const candidates: PostArchetype[] = [
    'add_specific_example',
    'extend_with_framework',
    'proof_backed_response',
    'customer_pain_bridge',
    'build_update',
    'founder_belief',
    'question',
    'thread_seed',
  ];

  let preferred: PostArchetype = 'add_specific_example';
  if (/\bmetric|result|proof|traction|usage|data\b/.test(content)) {
    preferred = 'proof_backed_response';
  } else if (/\bworkflow|customer|pain|problem|friction\b/.test(content)) {
    preferred = 'customer_pain_bridge';
  } else if (/\bship|launch|release|demo|feature|build\b/.test(content)) {
    preferred = 'build_update';
  } else if (/\bwhy|framework|system|incentive|pattern\b/.test(content)) {
    preferred = 'extend_with_framework';
  } else if (/\bquestion|ask|wonder\b/.test(content)) {
    preferred = 'question';
  }

  if (!recent.includes(preferred)) {
    return preferred;
  }

  return candidates.find((candidate) => !recent.includes(candidate)) || preferred;
}

export function summarizeOutcomeSignals(outcomes: DistributionOutcome[]) {
  const safeTotal = (items: Array<number | null>) =>
    items.reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);

  return {
    impressions: safeTotal(outcomes.map((item) => item.impressions)),
    profileVisits: safeTotal(outcomes.map((item) => item.profile_visits)),
    followsGained: safeTotal(outcomes.map((item) => item.follows_gained)),
    bookmarks: safeTotal(outcomes.map((item) => item.bookmarks)),
  };
}
