'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import Link from 'next/link';
import {
  answerReflectionTurn,
  deleteGeneratedTweet,
  getPendingTweets,
  getReviewLearningState,
  getTweetHistory,
  skipReflectionTurn,
  submitDraftDecision,
} from '../actions';
import ReflectionPromptCard from '../ReflectionPromptCard';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Sparkles,
  Trash2,
  Twitter,
  X,
  XCircle,
} from 'lucide-react';
import { getFeedbackTagLabel, FEEDBACK_TAG_OPTIONS, type FeedbackTag, type ReflectionTurn } from '@/utils/self-model';
import type { GeneratedTweetRecord } from '@/utils/self-model';
import { getReviewStatusLabel, isReadyToPost } from '@/utils/review-status';
import type { GeneratedTweetMode } from '@/utils/startup';

type Tab = 'pending' | 'history';

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

export default function ReviewDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [pendingMode, setPendingMode] = useState<GeneratedTweetMode>('general');
  const [historyMode, setHistoryMode] = useState<GeneratedTweetMode | 'all'>('all');
  const [tweets, setTweets] = useState<GeneratedTweetRecord[]>([]);
  const [historyTweets, setHistoryTweets] = useState<GeneratedTweetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [feedbackTagsById, setFeedbackTagsById] = useState<Record<string, FeedbackTag[]>>({});
  const [feedbackNotesById, setFeedbackNotesById] = useState<Record<string, string>>({});
  const [draftFeedbackReflection, setDraftFeedbackReflection] = useState<ReflectionTurn | null>(null);

  async function refreshPendingTweets(mode: GeneratedTweetMode = pendingMode) {
    const result = await getPendingTweets(mode);
    if (result.success && result.data) {
      setTweets(result.data);
      setError(null);
    } else {
      setError(getActionError(result, 'Failed to load pending tweets.'));
    }
  }

  async function refreshHistoryTweets(mode: GeneratedTweetMode | 'all' = historyMode) {
    setHistoryLoading(true);
    const result = await getTweetHistory(mode);
    if (result.success && result.data) {
      setHistoryTweets(result.data);
      setError(null);
    } else {
      setError(getActionError(result, 'Failed to load tweet history.'));
    }
    setHistoryLoading(false);
  }

  useEffect(() => {
    async function loadInitialTweets() {
      const [pendingResult, reviewLearningResult] = await Promise.all([
        getPendingTweets(pendingMode),
        getReviewLearningState(),
      ]);

      if (pendingResult.success && pendingResult.data) {
        setTweets(pendingResult.data);
        setError(null);
      } else {
        setError(getActionError(pendingResult, 'Failed to load pending tweets.'));
      }

      if (reviewLearningResult.success && reviewLearningResult.data) {
        setDraftFeedbackReflection(reviewLearningResult.data.pendingFeedback);
      }
      setLoading(false);
    }

    void loadInitialTweets();
  }, [pendingMode]);

  useEffect(() => {
    if (activeTab !== 'history') {
      return;
    }

    async function loadHistoryTweets() {
      setHistoryLoading(true);
      const result = await getTweetHistory(historyMode);
      if (result.success && result.data) {
        setHistoryTweets(result.data);
        setError(null);
      } else {
        setError(getActionError(result, 'Failed to load tweet history.'));
      }
      setHistoryLoading(false);
    }

    void loadHistoryTweets();
  }, [activeTab, historyMode]);

  const handleAutoGenerationCompleted = useEffectEvent(() => {
    void refreshPendingTweets(pendingMode);
    if (activeTab === 'history') {
      void refreshHistoryTweets(historyMode);
    }
  });

  useEffect(() => {
    function handleEvent() {
      handleAutoGenerationCompleted();
    }

    window.addEventListener('autogen:completed', handleEvent);
    return () => window.removeEventListener('autogen:completed', handleEvent);
  }, []);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);

    try {
      const endpoint = pendingMode === 'startup' ? '/api/startup/generate' : '/api/generate';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Generation failed.');
      }

      await refreshPendingTweets(pendingMode);
      setToast(
        pendingMode === 'startup'
          ? 'Generated a startup-specific draft set.'
          : 'Generated a thesis-ranked draft set.'
      );
      window.setTimeout(() => setToast(null), 2800);
    } catch (generationError) {
      const message =
        generationError instanceof Error ? generationError.message : 'Generation failed.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleFeedbackTag(tweetId: string, tag: FeedbackTag) {
    setFeedbackTagsById((previous) => {
      const current = previous[tweetId] || [];
      const next = current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag];
      return { ...previous, [tweetId]: next };
    });
  }

  function updateDraftContent(tweetId: string, nextContent: string) {
    setTweets((previous) =>
      previous.map((tweet) => (tweet.id === tweetId ? { ...tweet, content: nextContent } : tweet))
    );
  }

  async function handleDecision(tweet: GeneratedTweetRecord, newStatus: 'APPROVED' | 'REJECTED' | 'OPENED_IN_X') {
    const currentTweet = tweets.find((item) => item.id === tweet.id) || tweet;
    const nextContent = currentTweet.content;
    const feedbackTags = feedbackTagsById[tweet.id] || [];
    const freeformNote = feedbackNotesById[tweet.id] || '';

    setActiveActionId(tweet.id);
    setError(null);

    if (newStatus === 'OPENED_IN_X') {
      const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(nextContent)}`;
      window.open(intentUrl, '_blank');
    }

    const result = await submitDraftDecision({
      id: tweet.id,
      newContent: nextContent,
      newStatus,
      originalContent: tweet.content,
      feedbackTags,
      freeformNote,
    });

    setActiveActionId(null);

    if (!result.success) {
      setError(getActionError(result, 'Failed to save draft feedback.'));
      return;
    }

    setTweets((previous) => previous.filter((item) => item.id !== tweet.id));
    setFeedbackTagsById((previous) => ({ ...previous, [tweet.id]: [] }));
    setFeedbackNotesById((previous) => ({ ...previous, [tweet.id]: '' }));

    if ('reflection' in result && result.reflection) {
      setDraftFeedbackReflection(result.reflection);
    }

    await refreshHistoryTweets(historyMode);
    setToast(
      newStatus === 'OPENED_IN_X'
        ? 'Opened in X and logged your feedback.'
        : newStatus === 'APPROVED'
        ? 'Draft approved and learned from.'
        : 'Draft rejected and logged as a taste signal.'
    );
    window.setTimeout(() => setToast(null), 2800);
  }

  async function handleDeleteTweet(tweetId: string, surface: 'pending' | 'history') {
    const previousPending = tweets;
    const previousHistory = historyTweets;

    if (surface === 'pending') {
      setTweets((current) => current.filter((tweet) => tweet.id !== tweetId));
    } else {
      setHistoryTweets((current) => current.filter((tweet) => tweet.id !== tweetId));
    }

    setError(null);
    const result = await deleteGeneratedTweet(tweetId);

    if (!result.success) {
      setTweets(previousPending);
      setHistoryTweets(previousHistory);
      setError(getActionError(result, 'Failed to delete tweet.'));
      return;
    }

    setToast('Draft deleted.');
    window.setTimeout(() => setToast(null), 2800);
  }

  async function handleReflectionAnswer(answer: string) {
    if (!draftFeedbackReflection) {
      return;
    }

    const result = await answerReflectionTurn(draftFeedbackReflection.id, answer);
    if (!result.success) {
      throw new Error(getActionError(result, 'Failed to save reflection.'));
    }

    setDraftFeedbackReflection('nextReflection' in result ? result.nextReflection || null : null);
  }

  async function handleReflectionSkip() {
    if (!draftFeedbackReflection) {
      return;
    }

    const result = await skipReflectionTurn(draftFeedbackReflection.id);
    if (!result.success) {
      throw new Error(getActionError(result, 'Failed to skip reflection.'));
    }

    setDraftFeedbackReflection(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-4 pb-24 text-zinc-100 sm:p-12">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-zinc-900 pb-8">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Review Drafts</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:max-w-2xl">
              Approvals, edits, rejections, and what felt off all feed back into the system as
              taste signals.
            </p>
          </div>

          <div className="mt-5 flex w-fit items-center gap-1 rounded-lg bg-zinc-900/50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'pending'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Pending Queue
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'history'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              History
            </button>
          </div>

          {activeTab === 'pending' ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 rounded-lg bg-zinc-900/50 p-1">
                {(['general', 'startup'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPendingMode(mode)}
                    className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                      pendingMode === mode
                        ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {mode === 'general' ? 'General' : 'Startup'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={isGenerating}
                className={`inline-flex items-center gap-2.5 rounded-xl border px-6 py-3 text-sm font-semibold transition-all ${
                  isGenerating
                    ? 'cursor-not-allowed border-violet-500/15 bg-violet-500/[0.08] text-zinc-400'
                    : 'border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-blue-500/15 text-violet-300 hover:from-violet-500/25 hover:to-blue-500/25'
                }`}
              >
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {isGenerating
                  ? 'Generating...'
                  : pendingMode === 'startup'
                  ? 'Generate Startup Draft'
                  : 'Generate General Draft'}
              </button>
              <span className="text-xs text-zinc-500">
                Auto-generation also checks in every 4.5 hours while the app is active.
              </span>
            </div>
          ) : null}
        </header>

        {draftFeedbackReflection ? (
          <section className="mt-8">
            <ReflectionPromptCard
              reflection={draftFeedbackReflection}
              title="Review Follow-Up"
              description="This is how the system learns why a draft was close, off, or not really yours."
              submitLabel="Save Taste Signal"
              onSubmit={handleReflectionAnswer}
              onSkip={handleReflectionSkip}
            />
          </section>
        ) : null}

        {toast ? (
          <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
            {toast}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-500">
            {error}
          </div>
        ) : null}

        {activeTab === 'pending' ? (
          <div className="mt-8 space-y-6">
            {tweets.length === 0 && !error ? (
              <div className="rounded-xl border border-zinc-900 border-dashed py-20 text-center text-zinc-600">
                {pendingMode === 'startup'
                  ? 'No pending startup drafts right now. Generate one from the startup workspace or here.'
                  : 'No pending general drafts right now. Generate a new thesis-led draft to start the loop.'}
              </div>
            ) : null}

            {tweets.map((tweet) => {
              const feedbackTags = feedbackTagsById[tweet.id] || [];
              const feedbackNote = feedbackNotesById[tweet.id] || '';
              const isWorking = activeActionId === tweet.id;

              return (
                <div
                  key={tweet.id}
                  className="rounded-2xl border border-zinc-900 bg-zinc-950 p-6 transition-all hover:border-zinc-800"
                >
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500">
                    <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                      {tweet.generation_mode === 'startup' ? 'Startup' : 'General'}
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleDeleteTweet(tweet.id, 'pending')}
                      className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                      title="Delete draft"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <textarea
                    className="mb-4 min-h-[110px] w-full resize-none bg-transparent text-lg leading-relaxed text-zinc-200 outline-none"
                    value={tweet.content}
                    onChange={(event) => updateDraftContent(tweet.id, event.target.value)}
                    spellCheck={false}
                  />

                  {tweet.rationale ? (
                    <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Why This Fits
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
                        {tweet.rationale}
                      </p>
                    </div>
                  ) : null}

                  {tweet.theses && tweet.theses.length > 0 ? (
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Candidate Theses
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tweet.theses.map((thesis) => (
                          <span
                            key={thesis}
                            className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400"
                          >
                            {thesis}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {tweet.alternates && tweet.alternates.length > 0 ? (
                    <div className="mb-4 grid gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                        Alternates
                      </p>
                      {tweet.alternates.map((alternate, index) => (
                        <div
                          key={`${tweet.id}-alternate-${index}`}
                          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">
                                {alternate.thesis}
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                                {alternate.draft}
                              </p>
                              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                                {alternate.why_it_fits}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateDraftContent(tweet.id, alternate.draft)}
                              className="shrink-0 rounded-full border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                            >
                              Use This
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      What felt off or right?
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {FEEDBACK_TAG_OPTIONS.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => toggleFeedbackTag(tweet.id, tag)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            feedbackTags.includes(tag)
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                              : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                          }`}
                        >
                          {getFeedbackTagLabel(tag)}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={feedbackNote}
                      onChange={(event) =>
                        setFeedbackNotesById((previous) => ({
                          ...previous,
                          [tweet.id]: event.target.value,
                        }))
                      }
                      placeholder="Optional note: what was off, what you tightened, what you would really say instead."
                      className="mt-3 min-h-[90px] w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                      spellCheck={false}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <span className="text-xs font-mono text-zinc-600">{tweet.content.length}/280</span>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void handleDecision(tweet, 'REJECTED')}
                        disabled={isWorking}
                        className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecision(tweet, 'APPROVED')}
                        disabled={isWorking}
                        className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-6 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-1 rounded-lg bg-zinc-900/50 p-1">
              {(['all', 'general', 'startup'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setHistoryMode(mode)}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                    historyMode === mode
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {mode === 'all' ? 'All' : mode === 'general' ? 'General' : 'Startup'}
                </button>
              ))}
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
              </div>
            ) : null}

            {!historyLoading && historyTweets.length === 0 && !error ? (
              <div className="rounded-xl border border-zinc-900 border-dashed py-20 text-center text-zinc-600">
                No history yet. Approve, reject, or open some drafts in X to build the learning
                trail.
              </div>
            ) : null}

            {!historyLoading &&
              historyTweets.map((tweet) => (
                <div
                  key={tweet.id}
                  className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5 transition-all hover:border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-zinc-500">
                        <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                          {tweet.generation_mode === 'startup' ? 'Startup' : 'General'}
                        </span>
                        <button
                          type="button"
                          onClick={() => void handleDeleteTweet(tweet.id, 'history')}
                          className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                          title="Delete draft"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-[15px] leading-relaxed text-zinc-300">{tweet.content}</p>
                      {tweet.rationale ? (
                        <p className="mt-3 text-sm leading-relaxed text-zinc-500">{tweet.rationale}</p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                        tweet.status === 'OPENED_IN_X' || tweet.status === 'PUBLISHED'
                          ? 'bg-blue-500/10 text-blue-400'
                          : tweet.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {tweet.status === 'OPENED_IN_X' || tweet.status === 'PUBLISHED' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ExternalLink className="h-3 w-3" />
                          {getReviewStatusLabel(tweet.status)}
                        </span>
                      ) : tweet.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3" />
                          {getReviewStatusLabel(tweet.status)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <XCircle className="h-3 w-3" />
                          {getReviewStatusLabel(tweet.status)}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-4">
                    <span className="text-xs font-mono text-zinc-700">
                      {new Date(tweet.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>

                    {isReadyToPost(tweet.status) ? (
                      <button
                        type="button"
                        onClick={() => void handleDecision(tweet, 'OPENED_IN_X')}
                        disabled={activeActionId === tweet.id}
                        className="flex items-center gap-2 rounded-lg bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-950 transition-all hover:bg-white disabled:opacity-50"
                      >
                        {activeActionId === tweet.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Twitter className="h-3.5 w-3.5 fill-current" />
                        )}
                        Open in X
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
