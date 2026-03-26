'use server';

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { revalidatePath } from 'next/cache';
import { GENERATION_MODEL } from '@/utils/ai-config';
import { parseJsonResponse } from '@/utils/ai-json';
import {
  getDefaultNarrativePillars,
  isConversationRecommendedAction,
  isCommunityAudienceFocus,
  isOutcomeKind,
  isProofAssetKind,
  normalizeStringList,
  slugifyCommunityName,
  summarizeOutcomeSignals,
  type CompanyImageProfile,
  type CommunityProfile,
  type ConversationOpportunity,
  type ConversationSourceType,
  type DistributionOutcome,
  type NarrativePillar,
  type OutcomeKind,
  type ProofAsset,
  type ProofAssetKind,
  type TargetAccount,
} from '@/utils/distribution';
import { getErrorMessage } from '@/utils/errors';
import { scrapeUrl } from '@/utils/scraper';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CompanyImageProfileRow = CompanyImageProfile;
type CommunityProfileRow = Omit<CommunityProfile, 'common_topics' | 'preferred_post_shapes'> & {
  common_topics: string[] | null;
  preferred_post_shapes: string[] | null;
};
type NarrativePillarRow = NarrativePillar;
type ProofAssetRow = ProofAsset;
type TargetAccountRow = TargetAccount;
type ConversationOpportunityRow = Omit<ConversationOpportunity, 'topic_tags'> & {
  topic_tags: string[] | null;
};
type DistributionOutcomeRow = DistributionOutcome;

function detectConversationSourceType(sourceUrl: string | undefined, pastedText: string) {
  if (sourceUrl?.trim()) {
    const normalized = sourceUrl.toLowerCase();
    if (normalized.includes('/status/')) {
      return 'tweet_url' as const;
    }
    if (normalized.includes('/search')) {
      return 'search_url' as const;
    }
    return 'profile_url' as const;
  }

  return pastedText.includes('\n\n') ? ('thread_text' as const) : ('manual_paste' as const);
}

function mapConversationOpportunity(row: ConversationOpportunityRow): ConversationOpportunity {
  return {
    ...row,
    topic_tags: normalizeStringList(row.topic_tags),
  };
}

function mapCommunityProfile(row: CommunityProfileRow): CommunityProfile {
  return {
    ...row,
    common_topics: normalizeStringList(row.common_topics),
    preferred_post_shapes: normalizeStringList(row.preferred_post_shapes),
  };
}

async function ensureCompanyImageProfileRow() {
  const { data: existingProfile, error: existingError } = await supabase
    .from('company_image_profiles')
    .select(
      'id, company_name, known_for, who_it_helps, painful_problem, proof_points, objection_patterns, positioning_statements, bio_direction, header_concept, pinned_post_strategy, link_intent, updated_at'
    )
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingError && existingProfile) {
    return existingProfile as CompanyImageProfileRow;
  }

  const { data: insertedProfile, error: insertError } = await supabase
    .from('company_image_profiles')
    .insert([
      {
        company_name: '',
        known_for: '',
        who_it_helps: '',
        painful_problem: '',
        proof_points: '',
        objection_patterns: '',
        positioning_statements: '',
        bio_direction: '',
        header_concept: '',
        pinned_post_strategy: '',
        link_intent: '',
        updated_at: new Date().toISOString(),
      },
    ])
    .select(
      'id, company_name, known_for, who_it_helps, painful_problem, proof_points, objection_patterns, positioning_statements, bio_direction, header_concept, pinned_post_strategy, link_intent, updated_at'
    )
    .single();

  if (insertError || !insertedProfile) {
    throw new Error('Failed to initialize company image profile.');
  }

  return insertedProfile as CompanyImageProfileRow;
}

async function ensureDefaultPillars() {
  const { data: existingPillars } = await supabase
    .from('narrative_pillars')
    .select('id')
    .limit(1);

  if ((existingPillars?.length || 0) > 0) {
    return;
  }

  await supabase.from('narrative_pillars').insert(
    getDefaultNarrativePillars().map((pillar) => ({
      ...pillar,
      active: true,
    }))
  );
}

async function extractConversationItems(params: {
  sourceType: ConversationSourceType;
  sourceUrl?: string;
  rawInput: string;
}) {
  const response = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: `Source type: ${params.sourceType}\nSource URL: ${params.sourceUrl || 'None'}\n\nInput:\n${params.rawInput}`,
    config: {
      temperature: 0.3,
      systemInstruction: `You are normalizing X conversation opportunities for a founder growth system.
Return JSON only:
{
  "items": [
    {
      "author_handle": "optional",
      "author_name": "optional",
      "content": "...",
      "topic_tags": ["..."],
      "why_it_matters": "...",
      "recommended_action": "reply|quote|ignore|save_as_event"
    }
  ]
}

Rules:
- Extract up to 5 conversation opportunities.
- Preserve the original meaning of the post or snippet.
- why_it_matters should explain why it matters for company image or qualified reach.
- recommended_action should be the cheapest useful next move.`,
    },
  });

  const parsed = parseJsonResponse<{
    items?: Array<{
      author_handle?: string;
      author_name?: string;
      content?: string;
      topic_tags?: string[];
      why_it_matters?: string;
      recommended_action?: string;
    }>;
  }>(response.text || '', 'Failed to parse conversation opportunities');

  return (parsed.items || [])
    .map((item) => {
      const recommendedAction = isConversationRecommendedAction(item.recommended_action || '')
        ? item.recommended_action
        : 'reply';

      return {
        author_handle: String(item.author_handle || '')
          .trim()
          .replace(/^@/, ''),
        author_name: String(item.author_name || '').trim(),
        content: String(item.content || '').trim(),
        topic_tags: normalizeStringList(item.topic_tags).slice(0, 5),
        why_it_matters: String(item.why_it_matters || '').trim(),
        recommended_action: recommendedAction,
      };
    })
    .filter((item) => item.content);
}

export async function getDistributionWorkspace() {
  try {
    await ensureDefaultPillars();

    const [
      profile,
      pillarsResult,
      proofResult,
      targetResult,
      communityResult,
      conversationResult,
      draftResult,
      outcomeResult,
    ] =
      await Promise.all([
        ensureCompanyImageProfileRow(),
        supabase
          .from('narrative_pillars')
          .select('id, label, description, priority, active, created_at')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('proof_assets')
          .select('id, kind, title, content, asset_url, proof_strength, created_at')
          .order('proof_strength', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('target_accounts')
          .select('id, handle, display_name, reason, priority, monitoring_notes, created_at')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase
          .from('community_profiles')
          .select(
            'id, name, slug, description, audience_focus, tone_rules, common_topics, preferred_post_shapes, taboo_patterns, why_you_belong, active, created_at, updated_at'
          )
          .order('active', { ascending: false })
          .order('updated_at', { ascending: false }),
        supabase
          .from('conversation_opportunities')
          .select(
            'id, source_type, source_url, community_profile_id, community_label, author_handle, author_name, content, topic_tags, why_it_matters, recommended_action, status, raw_input, created_at'
          )
          .order('created_at', { ascending: false })
          .limit(24),
        supabase
          .from('generated_tweets')
          .select(
            'id, content, status, generation_mode, draft_kind, post_format, pillar_label, source_conversation_id, community_profile_id, community_label, post_archetype, surface_intent, created_at'
          )
          .in('draft_kind', ['reply', 'quote_post', 'original_post'])
          .order('created_at', { ascending: false })
          .limit(16),
        supabase
          .from('distribution_outcomes')
          .select(
            'id, generated_tweet_id, outcome_kind, impressions, likes, replies, reposts, bookmarks, profile_visits, follows_gained, link_clicks, notes, created_at'
          )
          .order('created_at', { ascending: false })
          .limit(24),
      ]);

    return {
      success: true,
      data: {
        profile: profile || null,
        pillars: (pillarsResult.data || []) as NarrativePillarRow[],
        proofAssets: (proofResult.data || []) as ProofAssetRow[],
        targetAccounts: (targetResult.data || []) as TargetAccountRow[],
        communityProfiles: ((communityResult.data || []) as CommunityProfileRow[]).map(
          mapCommunityProfile
        ),
        conversationOpportunities: ((conversationResult.data || []) as ConversationOpportunityRow[]).map(
          mapConversationOpportunity
        ),
        recentDrafts: draftResult.data || [],
        recentOutcomes: (outcomeResult.data || []) as DistributionOutcomeRow[],
        summary: summarizeOutcomeSignals((outcomeResult.data || []) as DistributionOutcomeRow[]),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to load distribution workspace.'),
    };
  }
}

export async function saveCommunityProfile(input: {
  id?: string;
  name: string;
  description: string;
  audienceFocus: string;
  toneRules: string;
  commonTopics?: string;
  preferredPostShapes?: string;
  tabooPatterns: string;
  whyYouBelong: string;
  active?: boolean;
}) {
  try {
    const name = input.name.trim();
    if (!name) {
      return { success: false, error: 'Community name is required.' };
    }

    const payload = {
      name,
      slug: slugifyCommunityName(name),
      description: input.description.trim(),
      audience_focus: isCommunityAudienceFocus(input.audienceFocus)
        ? input.audienceFocus
        : 'mixed',
      tone_rules: input.toneRules.trim(),
      common_topics: input.commonTopics
        ? input.commonTopics
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      preferred_post_shapes: input.preferredPostShapes
        ? input.preferredPostShapes
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
      taboo_patterns: input.tabooPatterns.trim(),
      why_you_belong: input.whyYouBelong.trim(),
      active: input.active ?? true,
      updated_at: new Date().toISOString(),
    };

    if (input.id) {
      const { error } = await supabase.from('community_profiles').update(payload).eq('id', input.id);
      if (error) {
        return { success: false, error: 'Failed to update community profile.' };
      }
    } else {
      const { error } = await supabase.from('community_profiles').insert([payload]);
      if (error) {
        return { success: false, error: 'Failed to save community profile.' };
      }
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to save community profile.'),
    };
  }
}

export async function deleteCommunityProfile(id: string) {
  try {
    const { error } = await supabase.from('community_profiles').delete().eq('id', id);
    if (error) {
      return { success: false, error: 'Failed to delete community profile.' };
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to delete community profile.'),
    };
  }
}

export async function updateCompanyImageProfile(data: {
  id?: string;
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
}) {
  try {
    const ensuredProfile = await ensureCompanyImageProfileRow();
    const payload = {
      company_name: data.company_name,
      known_for: data.known_for,
      who_it_helps: data.who_it_helps,
      painful_problem: data.painful_problem,
      proof_points: data.proof_points,
      objection_patterns: data.objection_patterns,
      positioning_statements: data.positioning_statements,
      bio_direction: data.bio_direction,
      header_concept: data.header_concept,
      pinned_post_strategy: data.pinned_post_strategy,
      link_intent: data.link_intent,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('company_image_profiles')
      .update(payload)
      .eq('id', data.id || ensuredProfile.id);

    if (error) {
      return { success: false, error: 'Failed to update company image profile.' };
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update company image profile.'),
    };
  }
}

export async function saveNarrativePillar(input: {
  id?: string;
  label: string;
  description: string;
  priority: number;
  active?: boolean;
}) {
  try {
    const payload = {
      label: input.label.trim(),
      description: input.description.trim(),
      priority: Math.max(1, Math.min(3, Math.round(input.priority || 1))),
      active: input.active ?? true,
    };

    if (!payload.label || !payload.description) {
      return { success: false, error: 'Pillar label and description are required.' };
    }

    if (input.id) {
      const { error } = await supabase
        .from('narrative_pillars')
        .update(payload)
        .eq('id', input.id);

      if (error) {
        return { success: false, error: 'Failed to update pillar.' };
      }
    } else {
      const { error } = await supabase.from('narrative_pillars').insert([payload]);
      if (error) {
        return { success: false, error: 'Failed to add pillar.' };
      }
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to save pillar.') };
  }
}

export async function deleteNarrativePillar(id: string) {
  try {
    const { error } = await supabase.from('narrative_pillars').delete().eq('id', id);
    if (error) {
      return { success: false, error: 'Failed to delete pillar.' };
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to delete pillar.') };
  }
}

export async function saveProofAsset(input: {
  kind: ProofAssetKind;
  title: string;
  content: string;
  assetUrl?: string;
  proofStrength: number;
}) {
  try {
    if (!input.title.trim() || !input.content.trim()) {
      return { success: false, error: 'Proof title and content are required.' };
    }

    const { error } = await supabase.from('proof_assets').insert([
      {
        kind: isProofAssetKind(input.kind) ? input.kind : 'product_change',
        title: input.title.trim(),
        content: input.content.trim(),
        asset_url: input.assetUrl?.trim() || null,
        proof_strength: Math.max(1, Math.min(5, Math.round(input.proofStrength || 3))),
      },
    ]);

    if (error) {
      return { success: false, error: 'Failed to save proof asset.' };
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to save proof asset.') };
  }
}

export async function deleteProofAsset(id: string) {
  try {
    const { error } = await supabase.from('proof_assets').delete().eq('id', id);
    if (error) {
      return { success: false, error: 'Failed to delete proof asset.' };
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to delete proof asset.') };
  }
}

export async function saveTargetAccount(input: {
  handle: string;
  displayName?: string;
  reason: string;
  priority: number;
  monitoringNotes?: string;
}) {
  try {
    if (!input.handle.trim() || !input.reason.trim()) {
      return { success: false, error: 'Handle and reason are required.' };
    }

    const { error } = await supabase.from('target_accounts').insert([
      {
        handle: input.handle.trim().replace(/^@/, ''),
        display_name: input.displayName?.trim() || '',
        reason: input.reason.trim(),
        priority: Math.max(1, Math.min(3, Math.round(input.priority || 2))),
        monitoring_notes: input.monitoringNotes?.trim() || '',
      },
    ]);

    if (error) {
      return { success: false, error: 'Failed to save target account.' };
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to save target account.') };
  }
}

export async function deleteTargetAccount(id: string) {
  try {
    const { error } = await supabase.from('target_accounts').delete().eq('id', id);
    if (error) {
      return { success: false, error: 'Failed to delete target account.' };
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error, 'Failed to delete target account.') };
  }
}

export async function importConversationOpportunities(input: {
  sourceUrl?: string;
  pastedText?: string;
  communityProfileId?: string;
}) {
  try {
    const sourceUrl = input.sourceUrl?.trim() || '';
    const pastedText = input.pastedText?.trim() || '';

    if (!sourceUrl && !pastedText) {
      return { success: false, error: 'Provide a URL or pasted conversation text.' };
    }

    let communityProfileId: string | null = input.communityProfileId?.trim() || null;
    let communityLabel: string | null = null;
    if (communityProfileId) {
      const { data: communityRow } = await supabase
        .from('community_profiles')
        .select('id, name')
        .eq('id', communityProfileId)
        .maybeSingle();
      if (!communityRow) {
        communityProfileId = null;
      } else {
        communityLabel = communityRow.name;
      }
    }

    let rawInput = pastedText;
    if (sourceUrl && !rawInput) {
      const scrapeResult = await scrapeUrl(sourceUrl);
      if (!scrapeResult.success) {
        return {
          success: false,
          error:
            scrapeResult.error ||
            'Could not read that page. Paste the tweet or thread text manually instead.',
        };
      }

      rawInput = [scrapeResult.title || '', scrapeResult.content].filter(Boolean).join('\n\n');
    }

    const sourceType = detectConversationSourceType(sourceUrl || undefined, rawInput);
    const items = await extractConversationItems({
      sourceType,
      sourceUrl: sourceUrl || undefined,
      rawInput: rawInput.slice(0, 12000),
    });

    if (items.length === 0) {
      return { success: false, error: 'No usable conversation opportunities were found.' };
    }

    const { data, error } = await supabase
      .from('conversation_opportunities')
      .insert(
        items.map((item) => ({
          source_type: sourceType,
          source_url: sourceUrl || null,
          community_profile_id: communityProfileId,
          community_label: communityLabel,
          author_handle: item.author_handle || null,
          author_name: item.author_name || null,
          content: item.content,
          topic_tags: item.topic_tags,
          why_it_matters: item.why_it_matters,
          recommended_action: item.recommended_action,
          status: 'new',
          raw_input: rawInput,
        }))
      )
      .select(
        'id, source_type, source_url, community_profile_id, community_label, author_handle, author_name, content, topic_tags, why_it_matters, recommended_action, status, raw_input, created_at'
      );

    if (error) {
      return { success: false, error: 'Failed to save conversation opportunities.' };
    }

    revalidatePath('/distribution');
    return {
      success: true,
      data: ((data || []) as ConversationOpportunityRow[]).map(mapConversationOpportunity),
      message: `${items.length} conversation opportunit${items.length === 1 ? 'y' : 'ies'} imported.`,
    };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to import conversation opportunities.'),
    };
  }
}

export async function deleteConversationOpportunity(id: string) {
  try {
    const { error } = await supabase.from('conversation_opportunities').delete().eq('id', id);
    if (error) {
      return { success: false, error: 'Failed to delete conversation opportunity.' };
    }

    revalidatePath('/distribution');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to delete conversation opportunity.'),
    };
  }
}

export async function updateConversationOpportunityStatus(input: {
  id: string;
  status: 'new' | 'used' | 'ignored' | 'saved_as_event';
}) {
  try {
    const { error } = await supabase
      .from('conversation_opportunities')
      .update({ status: input.status })
      .eq('id', input.id);

    if (error) {
      return { success: false, error: 'Failed to update conversation opportunity status.' };
    }

    revalidatePath('/distribution');
    revalidatePath('/timeline');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to update conversation opportunity status.'),
    };
  }
}

export async function saveDistributionOutcome(input: {
  generatedTweetId: string;
  outcomeKind: OutcomeKind;
  impressions?: number | null;
  likes?: number | null;
  replies?: number | null;
  reposts?: number | null;
  bookmarks?: number | null;
  profileVisits?: number | null;
  followsGained?: number | null;
  linkClicks?: number | null;
  notes?: string;
}) {
  try {
    const outcomeKind = isOutcomeKind(input.outcomeKind)
      ? input.outcomeKind
      : 'performance_update';
    const payload = {
      generated_tweet_id: input.generatedTweetId,
      outcome_kind: outcomeKind,
      impressions: input.impressions ?? null,
      likes: input.likes ?? null,
      replies: input.replies ?? null,
      reposts: input.reposts ?? null,
      bookmarks: input.bookmarks ?? null,
      profile_visits: input.profileVisits ?? null,
      follows_gained: input.followsGained ?? null,
      link_clicks: input.linkClicks ?? null,
      notes: input.notes?.trim() || '',
    };

    const { error } = await supabase.from('distribution_outcomes').insert([payload]);
    if (error) {
      return { success: false, error: 'Failed to save distribution outcome.' };
    }

    if (outcomeKind === 'posted_manually') {
      await supabase.from('generated_tweets').update({ status: 'PUBLISHED' }).eq('id', input.generatedTweetId);
    }

    revalidatePath('/distribution');
    revalidatePath('/review');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: getErrorMessage(error, 'Failed to save distribution outcome.'),
    };
  }
}
