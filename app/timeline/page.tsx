'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  getDistributionWorkspace,
  updateConversationOpportunityStatus,
} from '../distribution/actions';
import type {
  CommunityProfile,
  ConversationOpportunity,
  TargetAccount,
} from '@/utils/distribution';
import { Loader2, ExternalLink, MessageSquareQuote, Quote, Users, CheckCircle2, XCircle } from 'lucide-react';

type TimelineDraftRecord = {
  id: string;
  content: string;
  status: string;
  generation_mode?: string;
  draft_kind?: 'original_post' | 'reply' | 'quote_post';
  post_format?: string | null;
  pillar_label?: string | null;
  community_profile_id?: string | null;
  community_label?: string | null;
  source_conversation_id?: string | null;
  post_archetype?: string | null;
  surface_intent?: string | null;
  created_at: string;
};

function getActionError(result: unknown, fallback: string) {
  if (
    result &&
    typeof result === 'object' &&
    'error' in result &&
    typeof result.error === 'string' &&
    result.error.trim()
  ) {
    return result.error;
  }

  return fallback;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getQueueLabel(opportunity: ConversationOpportunity) {
  if (opportunity.recommended_action === 'quote') {
    return 'Quote';
  }
  if (opportunity.recommended_action === 'save_as_event') {
    return 'Save as event';
  }
  return 'Reply';
}

export default function TimelinePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeCommunityId, setActiveCommunityId] = useState<string>('all');
  const [communities, setCommunities] = useState<CommunityProfile[]>([]);
  const [opportunities, setOpportunities] = useState<ConversationOpportunity[]>([]);
  const [targetAccounts, setTargetAccounts] = useState<TargetAccount[]>([]);
  const [recentDrafts, setRecentDrafts] = useState<TimelineDraftRecord[]>([]);
  const [workingKey, setWorkingKey] = useState<string | null>(null);

  async function refreshTimeline() {
    const result = await getDistributionWorkspace();
    if (!result.success || !result.data) {
      throw new Error(getActionError(result, 'Failed to load timeline.'));
    }

    setCommunities(result.data.communityProfiles || []);
    setOpportunities(result.data.conversationOpportunities || []);
    setTargetAccounts(result.data.targetAccounts || []);
    setRecentDrafts((result.data.recentDrafts || []) as TimelineDraftRecord[]);
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshTimeline();
      } catch (timelineError) {
        setError(
          timelineError instanceof Error ? timelineError.message : 'Failed to load timeline.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visibleOpportunities = useMemo(() => {
    return opportunities.filter((item) => {
      if (item.status !== 'new') {
        return false;
      }
      if (activeCommunityId === 'all') {
        return true;
      }
      return item.community_profile_id === activeCommunityId;
    });
  }, [activeCommunityId, opportunities]);

  const visibleDrafts = useMemo(() => {
    return recentDrafts.filter((draft) => {
      if (activeCommunityId === 'all') {
        return true;
      }
      return draft.community_profile_id === activeCommunityId;
    });
  }, [activeCommunityId, recentDrafts]);

  const visibleCommunities = useMemo(() => {
    if (activeCommunityId === 'all') {
      return communities;
    }
    return communities.filter((community) => community.id === activeCommunityId);
  }, [activeCommunityId, communities]);

  const todayPlan = useMemo(() => {
    const topReplies = visibleOpportunities.filter((item) => item.recommended_action === 'reply').slice(0, 2);
    const topQuotes = visibleOpportunities.filter((item) => item.recommended_action === 'quote').slice(0, 1);
    const communityPost = activeCommunityId === 'all' ? communities[0] || null : communities.find((community) => community.id === activeCommunityId) || null;
    return { topReplies, topQuotes, communityPost };
  }, [activeCommunityId, communities, visibleOpportunities]);

  async function handleGenerateConversationDraft(
    conversationOpportunityId: string,
    draftKind: 'reply' | 'quote_post'
  ) {
    setWorkingKey(`${conversationOpportunityId}-${draftKind}`);
    setError(null);

    try {
      const response = await fetch('/api/distribution/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftKind, conversationOpportunityId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate draft.');
      }

      await refreshTimeline();
      setToast(draftKind === 'reply' ? 'Reply drafted.' : 'Quote post drafted.');
      window.setTimeout(() => setToast(null), 2500);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Failed to generate draft.');
    } finally {
      setWorkingKey(null);
    }
  }

  async function handleGenerateCommunityPost(communityProfileId: string) {
    setWorkingKey(`community-${communityProfileId}`);
    setError(null);

    try {
      const response = await fetch('/api/distribution/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftKind: 'original_post', communityProfileId }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate community post.');
      }

      await refreshTimeline();
      setToast('Community post drafted.');
      window.setTimeout(() => setToast(null), 2500);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate community post.'
      );
    } finally {
      setWorkingKey(null);
    }
  }

  async function handleStatusChange(
    id: string,
    status: 'used' | 'ignored'
  ) {
    setWorkingKey(`${id}-${status}`);
    setError(null);
    const result = await updateConversationOpportunityStatus({ id, status });
    setWorkingKey(null);

    if (!result.success) {
      setError(getActionError(result, 'Failed to update queue item.'));
      return;
    }

    await refreshTimeline();
    setToast(status === 'used' ? 'Marked as used.' : 'Marked as ignored.');
    window.setTimeout(() => setToast(null), 2500);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 pb-28 text-zinc-100 sm:pb-14">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-indigo-300">
                <Users className="h-3.5 w-3.5" />
                Timeline
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50">
                Community engagement queue
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                This is the operational view: which communities matter, what conversations are live,
                what should be replied to, and what community-specific post should go out next.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/distribution"
                className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500"
              >
                Back to Distribution
              </Link>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveCommunityId('all')}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                activeCommunityId === 'all'
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              All communities
            </button>
            {communities.map((community) => (
              <button
                key={community.id}
                type="button"
                onClick={() => setActiveCommunityId(community.id)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  activeCommunityId === community.id
                    ? 'bg-zinc-100 text-zinc-950'
                    : 'border border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                {community.name}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}
          {toast ? (
            <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {toast}
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <h2 className="text-xl font-semibold text-zinc-50">Today&apos;s plan</h2>
            <div className="mt-5 space-y-4">
              {todayPlan.communityPost ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Community post
                  </div>
                  <div className="mt-2 text-sm font-semibold text-zinc-100">
                    Draft one native post for {todayPlan.communityPost.name}
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">
                    {todayPlan.communityPost.description || todayPlan.communityPost.why_you_belong}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleGenerateCommunityPost(todayPlan.communityPost!.id)}
                    disabled={workingKey === `community-${todayPlan.communityPost.id}`}
                    className="mt-4 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {workingKey === `community-${todayPlan.communityPost.id}`
                      ? 'Generating...'
                      : 'Draft community post'}
                  </button>
                </div>
              ) : null}

              {todayPlan.topReplies.map((item) => (
                <div key={item.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Reply opportunity
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-200">{item.content}</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void handleGenerateConversationDraft(item.id, 'reply')}
                      disabled={workingKey === `${item.id}-reply`}
                      className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {workingKey === `${item.id}-reply` ? 'Generating...' : 'Draft reply'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusChange(item.id, 'ignored')}
                      disabled={workingKey === `${item.id}-ignored`}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              ))}

              {todayPlan.topQuotes.map((item) => (
                <div key={item.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    Quote-post opportunity
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-200">{item.content}</p>
                  <button
                    type="button"
                    onClick={() => void handleGenerateConversationDraft(item.id, 'quote_post')}
                    disabled={workingKey === `${item.id}-quote_post`}
                    className="mt-4 rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {workingKey === `${item.id}-quote_post` ? 'Generating...' : 'Draft quote post'}
                  </button>
                </div>
              ))}

              {todayPlan.topReplies.length === 0 && todayPlan.topQuotes.length === 0 && !todayPlan.communityPost ? (
                <div className="rounded-2xl border border-zinc-900 border-dashed p-8 text-sm text-zinc-500">
                  No active queue yet. Add community profiles or import conversations from the
                  Distribution workspace.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <h2 className="text-xl font-semibold text-zinc-50">Target accounts</h2>
            <div className="mt-5 space-y-3">
              {targetAccounts.slice(0, 8).map((account) => (
                <div key={account.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-sm font-semibold text-zinc-100">
                    @{account.handle}
                    {account.display_name ? ` · ${account.display_name}` : ''}
                  </div>
                  <p className="mt-2 text-sm text-zinc-400">{account.reason}</p>
                  {account.monitoring_notes ? (
                    <p className="mt-2 text-xs text-zinc-500">{account.monitoring_notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <h2 className="text-xl font-semibold text-zinc-50">Open queue</h2>
            <div className="mt-5 space-y-4">
              {visibleOpportunities.map((item) => (
                <div key={item.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                    <span>{item.community_label || 'General timeline'}</span>
                    <span>·</span>
                    <span>{getQueueLabel(item)}</span>
                    {item.author_handle ? (
                      <>
                        <span>·</span>
                        <span>@{item.author_handle}</span>
                      </>
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-200">{item.content}</p>
                  {item.why_it_matters ? (
                    <p className="mt-3 text-sm text-zinc-400">{item.why_it_matters}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        void handleGenerateConversationDraft(
                          item.id,
                          item.recommended_action === 'quote' ? 'quote_post' : 'reply'
                        )
                      }
                      disabled={
                        workingKey ===
                        `${item.id}-${item.recommended_action === 'quote' ? 'quote_post' : 'reply'}`
                      }
                      className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {item.recommended_action === 'quote' ? (
                        <span className="inline-flex items-center gap-2">
                          <Quote className="h-4 w-4" />
                          Draft quote post
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          <MessageSquareQuote className="h-4 w-4" />
                          Draft reply
                        </span>
                      )}
                    </button>
                    {item.source_url ? (
                      <a
                        href={item.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500"
                      >
                        <span className="inline-flex items-center gap-2">
                          <ExternalLink className="h-4 w-4" />
                          Open source
                        </span>
                      </a>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleStatusChange(item.id, 'used')}
                      disabled={workingKey === `${item.id}-used`}
                      className="rounded-full border border-emerald-500/30 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/10"
                    >
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Mark used
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusChange(item.id, 'ignored')}
                      disabled={workingKey === `${item.id}-ignored`}
                      className="rounded-full border border-red-500/30 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10"
                    >
                      <span className="inline-flex items-center gap-2">
                        <XCircle className="h-4 w-4" />
                        Ignore
                      </span>
                    </button>
                  </div>
                </div>
              ))}

              {visibleOpportunities.length === 0 ? (
                <div className="rounded-2xl border border-zinc-900 border-dashed p-8 text-sm text-zinc-500">
                  No open opportunities for this lane yet.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <h2 className="text-xl font-semibold text-zinc-50">Recent community drafts</h2>
            <div className="mt-5 space-y-3">
              {visibleDrafts.slice(0, 12).map((draft) => (
                <div key={draft.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                    {draft.community_label || 'General'} · {draft.draft_kind?.replace(/_/g, ' ') || 'draft'}
                    {draft.post_format ? ` · ${draft.post_format.replace(/_/g, ' ')}` : ''}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-200">{draft.content}</p>
                  <p className="mt-2 text-xs text-zinc-500">{formatDate(draft.created_at)} · {draft.status}</p>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {visibleCommunities.map((community) => {
            const laneItems = visibleOpportunities.filter((item) => item.community_profile_id === community.id);
            return (
              <div key={community.id} className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-50">{community.name}</h2>
                    <p className="mt-2 text-sm text-zinc-400">
                      {community.description || community.why_you_belong}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleGenerateCommunityPost(community.id)}
                    disabled={workingKey === `community-${community.id}`}
                    className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {workingKey === `community-${community.id}` ? 'Generating...' : 'Draft post'}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {community.common_topics.map((topic) => (
                    <span
                      key={`${community.id}-${topic}`}
                      className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
                <div className="mt-5 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  {laneItems.length} open opportunities
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
