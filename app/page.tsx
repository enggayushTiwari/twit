'use client';

import { useEffect, useRef, useState } from 'react';
import {
  answerReflectionTurn,
  createEventReflection,
  getHomeLearningState,
  saveIdeaWithEmbedding,
  skipReflectionTurn,
} from './actions';
import { Brain, CheckCircle2, Loader2, Newspaper, Plus, Sparkles } from 'lucide-react';
import UrlIngester from './UrlIngester';
import PersonaVault from './PersonaVault';
import ReflectionPromptCard from './ReflectionPromptCard';
import { getErrorMessage } from '@/utils/errors';
import type { LiveTopic } from '@/utils/discovery';
import {
  DISCOVERY_COUNTRIES,
  DISCOVERY_SOURCES,
  DISCOVERY_TOPICS,
  type DiscoveryCountryId,
  type DiscoverySourceId,
  type DiscoveryTopicId,
} from '@/utils/discovery-config';
import type { EventReflection, MindModelEntry, ReflectionTurn } from '@/utils/self-model';

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

async function fetchLiveTopicsFromApi(params: {
  country: DiscoveryCountryId;
  topic: DiscoveryTopicId;
  source: DiscoverySourceId;
}) {
  const searchParams = new URLSearchParams({
    country: params.country,
    topic: params.topic,
    source: params.source,
  });

  const response = await fetch(`/api/discover?${searchParams.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to load live topics.');
  }

  return data as {
    success: true;
    topics: LiveTopic[];
    meta: {
      selectedCountry: DiscoveryCountryId;
      selectedTopic: DiscoveryTopicId;
      selectedSource: DiscoverySourceId;
      xTrendsEnabled: boolean;
      xTrendsMessage: string | null;
      newsCount: number;
      xTrendCount: number;
      fetchedAt: string;
    };
  };
}

export default function Home() {
  const [idea, setIdea] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'idea' | 'project_log'>('idea');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [thinkError, setThinkError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [addedSuggestions, setAddedSuggestions] = useState<Set<number>>(new Set());
  const [captureReflection, setCaptureReflection] = useState<ReflectionTurn | null>(null);
  const [newsReflection, setNewsReflection] = useState<ReflectionTurn | null>(null);
  const [learnedEntries, setLearnedEntries] = useState<MindModelEntry[]>([]);
  const [eventHeadline, setEventHeadline] = useState('');
  const [eventUrl, setEventUrl] = useState('');
  const [eventSummary, setEventSummary] = useState('');
  const [eventLoading, setEventLoading] = useState(false);
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<EventReflection | null>(null);
  const [liveTopics, setLiveTopics] = useState<LiveTopic[]>([]);
  const [liveTopicsLoading, setLiveTopicsLoading] = useState(false);
  const [liveTopicsError, setLiveTopicsError] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<DiscoveryCountryId>('worldwide');
  const [selectedTopic, setSelectedTopic] = useState<DiscoveryTopicId>('general');
  const [selectedSource, setSelectedSource] = useState<DiscoverySourceId>('all');
  const [liveTopicsMeta, setLiveTopicsMeta] = useState<{
    selectedCountry: DiscoveryCountryId;
    selectedTopic: DiscoveryTopicId;
    selectedSource: DiscoverySourceId;
    xTrendsEnabled: boolean;
    xTrendsMessage: string | null;
    newsCount: number;
    xTrendCount: number;
    fetchedAt: string;
  } | null>(null);
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [idea]);

  useEffect(() => {
    async function loadLearningState() {
      const result = await getHomeLearningState();
      if (result.success && result.data) {
        setCaptureReflection(result.data.pendingCapture);
        setNewsReflection(result.data.pendingNews);
      }
    }

    void loadLearningState();
  }, []);

  useEffect(() => {
    async function loadLiveTopics() {
      try {
        setLiveTopicsLoading(true);
        const data = await fetchLiveTopicsFromApi({
          country: selectedCountry,
          topic: selectedTopic,
          source: selectedSource,
        });
        setLiveTopics(data.topics);
        setLiveTopicsMeta(data.meta);
        setLiveTopicsError(null);
      } catch (error) {
        setLiveTopicsError(getErrorMessage(error, 'Failed to load live topics.'));
      } finally {
        setLiveTopicsLoading(false);
      }
    }

    void loadLiveTopics();
  }, [selectedCountry, selectedSource, selectedTopic]);

  function pushLearnedEntries(entries: MindModelEntry[] | undefined) {
    if (!entries || entries.length === 0) {
      return;
    }

    setLearnedEntries((previous) => {
      const byId = new Map<string, MindModelEntry>();
      for (const entry of previous) {
        byId.set(entry.id, entry);
      }
      for (const entry of entries) {
        byId.set(entry.id, entry);
      }
      return Array.from(byId.values());
    });
  }

  async function handleSave() {
    if (!idea.trim()) {
      return;
    }

    setStatus('idle');
    setMessage('');
    setIsSaving(true);

    const result = await saveIdeaWithEmbedding(idea, activeTab);

    setIsSaving(false);

    if (!result.success) {
      setStatus('error');
      setMessage(getActionError(result, 'Error saving idea.'));
      return;
    }

    const signalType = result.extraction?.signalType
      ? ` Classified as ${result.extraction.signalType.replace('_', ' ')}.`
      : '';
    setStatus('success');
    setMessage(activeTab === 'project_log' ? `Saved to build memory.${signalType}` : `Saved to vault.${signalType}`);
    setIdea('');
    pushLearnedEntries(result.extraction?.suggestedEntries);

    if (result.extraction?.reflection) {
      setCaptureReflection(result.extraction.reflection);
    }

    window.setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, 3200);
  }

  async function handleBrainstorm() {
    setThinking(true);
    setThinkError(null);
    setSuggestions([]);
    setAddedSuggestions(new Set());

    try {
      const response = await fetch('/api/brainstorm', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to brainstorm');
      }

      setSuggestions(data.suggestions);
    } catch (err: unknown) {
      setThinkError(getErrorMessage(err, 'Failed to brainstorm'));
    } finally {
      setThinking(false);
    }
  }

  async function handleAddSuggestion(text: string, index: number) {
    setAddedSuggestions((previous) => new Set(previous).add(index));
    const result = await saveIdeaWithEmbedding(text, 'idea');
    if (!result.success) {
      alert(`Failed to save suggestion: ${result.error}`);
      setAddedSuggestions((previous) => {
        const next = new Set(previous);
        next.delete(index);
        return next;
      });
      return;
    }

    pushLearnedEntries(result.extraction?.suggestedEntries);
    if (result.extraction?.reflection) {
      setCaptureReflection(result.extraction.reflection);
    }
  }

  async function handleReflectionAnswer(reflection: ReflectionTurn, answer: string) {
    const result = await answerReflectionTurn(reflection.id, answer);
    if (!result.success) {
      throw new Error(getActionError(result, 'Failed to save reflection.'));
    }

    pushLearnedEntries('addedEntries' in result ? result.addedEntries : []);

    if (reflection.mode === 'capture_followup') {
      setCaptureReflection(null);
    }

    if (reflection.mode === 'news_reflection') {
      if ('nextReflection' in result && result.nextReflection) {
        setNewsReflection(result.nextReflection);
      } else {
        setNewsReflection(null);
      }

      if ('event' in result && result.event) {
        setLatestEvent(result.event);
      }
    }
  }

  async function handleSkipReflection(reflection: ReflectionTurn) {
    const result = await skipReflectionTurn(reflection.id);
    if (!result.success) {
      throw new Error(getActionError(result, 'Failed to skip reflection.'));
    }

    if (reflection.mode === 'capture_followup') {
      setCaptureReflection(null);
    }

    if (reflection.mode === 'news_reflection') {
      setNewsReflection(null);
    }
  }

  async function handleCreateEventReflection() {
    setEventLoading(true);
    setEventError(null);
    setEventMessage(null);

    const result = await createEventReflection({
      headline: eventHeadline,
      sourceUrl: eventUrl,
      sourceText: eventSummary,
    });

    setEventLoading(false);

    if (!result.success || !result.data) {
      setEventError(getActionError(result, 'Failed to capture event.'));
      return;
    }

    setLatestEvent(result.data.event);
    setNewsReflection(result.data.reflection);
    setEventMessage('Event captured. Now tell the system what you actually think about it.');
    setEventHeadline('');
    setEventUrl('');
    setEventSummary('');
  }

  async function handleRefreshLiveTopics() {
    try {
      setLiveTopicsLoading(true);
      const data = await fetchLiveTopicsFromApi({
        country: selectedCountry,
        topic: selectedTopic,
        source: selectedSource,
      });
      setLiveTopics(data.topics);
      setLiveTopicsMeta(data.meta);
      setLiveTopicsError(null);
    } catch (error) {
      setLiveTopicsError(getErrorMessage(error, 'Failed to refresh live topics.'));
    } finally {
      setLiveTopicsLoading(false);
    }
  }

  function handleUseTopicAsEvent(topic: LiveTopic) {
    setEventHeadline(topic.title);
    setEventUrl(topic.sourceUrl || topic.topicUrl || '');
    setEventSummary(topic.summary);
    setEventMessage('Loaded live topic into the event reflection box below.');
    setEventError(null);
  }

  async function handleStartTopicReflection(topic: LiveTopic) {
    setActiveTopicId(topic.id);
    setEventError(null);
    setEventMessage(null);

    const result = await createEventReflection({
      headline: topic.title,
      sourceUrl: topic.sourceUrl || topic.topicUrl || '',
      sourceText: topic.summary,
    });

    setActiveTopicId(null);

    if (!result.success || !result.data) {
      setEventError(getActionError(result, 'Failed to start reflection from this topic.'));
      return;
    }

    setLatestEvent(result.data.event);
    setNewsReflection(result.data.reflection);
    setEventMessage('Live topic captured. Now tell the system what you actually think about it.');
  }

  return (
    <div className="min-h-screen bg-[#050505] p-4 pb-24 sm:p-12 text-zinc-100 selection:bg-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
        <header className="border-b border-zinc-900 pb-8">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-100">Idea Engine</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Capture raw thoughts, reflect on events, and let the system gradually learn your
              worldview instead of waiting for a perfectly filled profile.
            </p>
          </div>

          <div className="mt-6 flex w-fit items-center gap-1 rounded-lg bg-zinc-900/50 p-1">
            <button
              type="button"
              onClick={() => setActiveTab('idea')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'idea'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Drop an Idea
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('project_log')}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
                activeTab === 'project_log'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Drop a Project Log
            </button>
          </div>
        </header>

        {(captureReflection || newsReflection || learnedEntries.length > 0 || latestEvent) && (
          <section className="space-y-5">
            {captureReflection ? (
              <ReflectionPromptCard
                reflection={captureReflection}
                title="Contextual Follow-Up"
                description="A short answer here helps the system turn one raw note into a clearer model of how you think."
                submitLabel="Save Interpretation"
                onSubmit={async (answer) => handleReflectionAnswer(captureReflection, answer)}
                onSkip={async () => handleSkipReflection(captureReflection)}
              />
            ) : null}

            {newsReflection ? (
              <ReflectionPromptCard
                reflection={newsReflection}
                title="Recent Event Reflection"
                description="Use current events to teach the system your point of view, not to copy news language."
                submitLabel="Save POV"
                onSubmit={async (answer) => handleReflectionAnswer(newsReflection, answer)}
                onSkip={async () => handleSkipReflection(newsReflection)}
              />
            ) : null}

            {latestEvent ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-300">
                  <Sparkles className="h-4 w-4" />
                  Active Event Context
                </div>
                <p className="mt-3 text-lg text-zinc-100">{latestEvent.headline}</p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{latestEvent.source_summary}</p>
                {latestEvent.derived_thesis ? (
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                      Derived Thesis
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                      {latestEvent.derived_thesis}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {learnedEntries.length > 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Fresh Inferences
                </div>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  These are suggested mind-model entries, not confirmed truth. Review them in the
                  Mind Model page.
                </p>
                <div className="mt-4 grid gap-3">
                  {learnedEntries.slice(0, 6).map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                        <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                          {entry.kind.replace('_', ' ')}
                        </span>
                        <span>confidence {Math.round(entry.confidence * 100)}%</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-200">{entry.statement}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        )}

        <section className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Capture
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Save raw thoughts. The app will infer what type of signal it sees, propose
              mind-model entries, and occasionally ask one sharp follow-up.
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-900 bg-zinc-950/80 p-6 sm:p-8">
            <textarea
              ref={textareaRef}
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              placeholder={
                activeTab === 'idea'
                  ? 'Drop a raw thought on startups, systems, incentives, leverage, distribution, or whatever you are noticing.'
                  : 'Paste a project log, architecture lesson, debugging pattern, or something you learned while building.'
              }
              className="min-h-[180px] w-full resize-none bg-transparent text-2xl leading-snug text-zinc-100 outline-none placeholder:text-zinc-800 sm:text-4xl"
              spellCheck={false}
              autoFocus
            />

            {status !== 'idle' ? (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
                  status === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
                    : 'border-red-500/20 bg-red-500/5 text-red-400'
                }`}
              >
                {message}
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-900 pt-5">
              <div className="flex items-center gap-6 text-sm">
                <span className="font-mono text-zinc-600">
                  {idea.length > 0 ? `${idea.length} chars` : 'Ready'}
                </span>
                <span className="text-zinc-600">
                  Output starts improving around 30 to 50 sharp ideas.
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={idea.trim().length === 0 || isSaving}
                className="rounded-full bg-zinc-100 px-6 py-2.5 text-sm font-medium text-[#050505] transition-all hover:scale-105 hover:bg-white active:scale-95 disabled:pointer-events-none disabled:opacity-30"
              >
                {isSaving ? 'Saving...' : 'Save Idea'}
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Newspaper className="h-4 w-4 text-amber-400" />
                  Live Topics to Comment On
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                  Pull live internet topics and X trends, then turn one into an event reflection so
                  the app can learn your take and use it in future tweets.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleRefreshLiveTopics()}
                  disabled={liveTopicsLoading}
                  className="rounded-full border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {liveTopicsLoading ? 'Refreshing...' : 'Refresh Topics'}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Country
                <select
                  value={selectedCountry}
                  onChange={(event) => setSelectedCountry(event.target.value as DiscoveryCountryId)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium normal-case tracking-normal text-zinc-200 outline-none transition-colors focus:border-zinc-600"
                >
                  {DISCOVERY_COUNTRIES.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Topic
                <select
                  value={selectedTopic}
                  onChange={(event) => setSelectedTopic(event.target.value as DiscoveryTopicId)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium normal-case tracking-normal text-zinc-200 outline-none transition-colors focus:border-zinc-600"
                >
                  {DISCOVERY_TOPICS.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Source
                <select
                  value={selectedSource}
                  onChange={(event) => setSelectedSource(event.target.value as DiscoverySourceId)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium normal-case tracking-normal text-zinc-200 outline-none transition-colors focus:border-zinc-600"
                >
                  {DISCOVERY_SOURCES.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {liveTopicsMeta?.xTrendsMessage ? (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 text-sm text-zinc-400">
                {liveTopicsMeta.xTrendsMessage}
              </div>
            ) : null}

            {liveTopicsMeta ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-full border border-zinc-800 px-3 py-1">
                  {DISCOVERY_COUNTRIES.find((item) => item.id === liveTopicsMeta.selectedCountry)?.label}
                </span>
                <span className="rounded-full border border-zinc-800 px-3 py-1">
                  {DISCOVERY_TOPICS.find((item) => item.id === liveTopicsMeta.selectedTopic)?.label}
                </span>
                <span className="rounded-full border border-zinc-800 px-3 py-1">
                  {DISCOVERY_SOURCES.find((item) => item.id === liveTopicsMeta.selectedSource)?.label}
                </span>
                <span>
                  {liveTopicsMeta.newsCount} news · {liveTopicsMeta.xTrendCount} X trends
                </span>
              </div>
            ) : null}

            {liveTopicsError ? (
              <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                {liveTopicsError}
              </div>
            ) : null}

            {liveTopics.length > 0 ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {liveTopics.map((topic) => (
                  <div
                    key={topic.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                      <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                        {topic.kind === 'x_trend' ? 'X trend' : 'News'}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                        {DISCOVERY_COUNTRIES.find((item) => item.id === topic.country)?.label || topic.country}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                        {DISCOVERY_TOPICS.find((item) => item.id === topic.topic)?.label || topic.topic}
                      </span>
                      <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                        {topic.recommendedArchetype.replace(/_/g, ' ')}
                      </span>
                      <span>{topic.sourceLabel}</span>
                      {topic.freshnessLabel ? <span>{topic.freshnessLabel}</span> : null}
                    </div>
                    <p className="mt-3 text-sm font-medium leading-relaxed text-zinc-100">
                      {topic.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">{topic.summary}</p>
                    <p className="mt-3 text-xs leading-relaxed text-amber-300">{topic.promptHint}</p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                      Postability {Math.round(topic.postabilityScore * 100)}% · build relevance {Math.round(topic.buildRelevanceScore * 100)}%
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleUseTopicAsEvent(topic)}
                        className="rounded-full border border-zinc-700 px-4 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
                      >
                        Use as Event
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleStartTopicReflection(topic)}
                        disabled={activeTopicId === topic.id}
                        className="rounded-full bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {activeTopicId === topic.id ? 'Starting...' : 'Start Reflection'}
                      </button>
                      {topic.topicUrl ? (
                        <a
                          href={topic.topicUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300"
                        >
                          Open Source
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : liveTopicsLoading ? (
              <div className="mt-5 flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching live topics...
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                <Newspaper className="h-4 w-4 text-amber-400" />
                Manual Event POV Capture
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                Paste a headline, link, or rough summary. The app will create a neutral summary, then
                ask what you actually think and what broader pattern it reveals.
              </p>

              <div className="mt-4 grid gap-3">
                <input
                  value={eventHeadline}
                  onChange={(event) => setEventHeadline(event.target.value)}
                  placeholder="Headline"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                />
                <input
                  value={eventUrl}
                  onChange={(event) => setEventUrl(event.target.value)}
                  placeholder="Source URL (optional)"
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                />
                <textarea
                  value={eventSummary}
                  onChange={(event) => setEventSummary(event.target.value)}
                  placeholder="Short summary or pasted excerpt"
                  className="min-h-[120px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                  spellCheck={false}
                />
              </div>

              {eventError ? (
                <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
                  {eventError}
                </div>
              ) : null}

              {eventMessage ? (
                <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
                  {eventMessage}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => void handleCreateEventReflection()}
                disabled={eventLoading}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {eventLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
                {eventLoading ? 'Capturing...' : 'Capture Event'}
              </button>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
                <UrlIngester />
              </div>
              <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
                <PersonaVault />
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-zinc-900/50 pt-12">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-medium">
                Co-Thinker
                <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-600">
                  Alpha
                </span>
              </h2>
              <p className="mt-1 text-sm text-zinc-500">
                Expand the vault into adjacent territory. This stays an inspiration engine, not the
                identity-learning layer.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleBrainstorm()}
              disabled={thinking}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                thinking
                  ? 'cursor-wait border-zinc-800 bg-zinc-900 text-zinc-500'
                  : 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/20'
              }`}
            >
              {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              {thinking ? 'Thinking...' : 'Brainstorm Adjacent Ideas'}
            </button>
          </div>

          {thinkError ? (
            <div className="mb-6 rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-500">
              {thinkError}
            </div>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 pb-10 md:grid-cols-3">
              {suggestions.map((suggestion, index) => {
                const isAdded = addedSuggestions.has(index);
                return (
                  <div
                    key={suggestion}
                    className={`flex flex-col justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-5 transition-all duration-500 ${
                      isAdded
                        ? 'opacity-50 grayscale'
                        : 'hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                    }`}
                  >
                    <p className="mb-4 max-h-[160px] overflow-y-auto pr-2 text-sm leading-relaxed text-zinc-300">
                      {suggestion}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleAddSuggestion(suggestion, index)}
                      disabled={isAdded}
                      className={`flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
                        isAdded
                          ? 'cursor-default bg-green-500/10 text-green-500'
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Added to Vault
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          Add to Vault
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
