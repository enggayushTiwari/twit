'use client';

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import {
  analyzePersona,
  answerReflectionTurn,
  getMindModelWorkspace,
  resolveMindModelEntry,
  skipReflectionTurn,
  updateProfile,
} from '../actions';
import ReflectionPromptCard from '../ReflectionPromptCard';
import {
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Save,
  Sparkles,
  User,
  XCircle,
} from 'lucide-react';
import {
  FEEDBACK_TAG_OPTIONS,
  getFeedbackTagLabel,
  groupMindModelEntries,
  type EventReflection,
  type FeedbackTag,
  type MindModelEntry,
  type ReflectionTurn,
} from '@/utils/self-model';

type WorkspaceMetrics = {
  suggestionConfirmationRate: number;
  draftApprovalRate: number;
  averageEditIntensity: number;
  rejectedByReason: Array<{ tag: string; count: number }>;
  confirmedEntryCount: number;
};

type ProfileData = {
  id?: string;
  desired_perception?: string | null;
  target_audience?: string | null;
  tone_guardrails?: string | null;
} | null;

function formatPercentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

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

function formatEntryKind(kind: string) {
  return kind.replace(/_/g, ' ');
}

type EntrySectionProps = {
  title: string;
  description: string;
  entries: MindModelEntry[];
  editable?: boolean;
  onResolve?: (entryId: string, action: 'confirm' | 'reject' | 'archive', statement?: string) => Promise<void>;
  editingStatements?: Record<string, string>;
  setEditingStatements?: Dispatch<SetStateAction<Record<string, string>>>;
};

function EntrySection({
  title,
  description,
  entries,
  editable = false,
  onResolve,
  editingStatements,
  setEditingStatements,
}: EntrySectionProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
      <div className="mb-4">
        <h2 className="text-lg font-medium text-zinc-100">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-zinc-500">{description}</p>
      </div>

      <div className="grid gap-3">
        {entries.map((entry) => {
          const draftStatement = editingStatements?.[entry.id] ?? entry.statement;

          return (
            <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                  {formatEntryKind(entry.kind)}
                </span>
                <span>confidence {Math.round(entry.confidence * 100)}%</span>
                <span>priority {entry.priority}</span>
              </div>

              {editable ? (
                <textarea
                  value={draftStatement}
                  onChange={(event) =>
                    setEditingStatements?.((previous) => ({
                      ...previous,
                      [entry.id]: event.target.value,
                    }))
                  }
                  className="mt-3 min-h-[88px] w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none focus:border-zinc-600"
                  spellCheck={false}
                />
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-zinc-200">{entry.statement}</p>
              )}

              {entry.evidence_summary ? (
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{entry.evidence_summary}</p>
              ) : null}

              {editable && onResolve ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void onResolve(entry.id, 'confirm', draftStatement)}
                    className="rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500 hover:text-white"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => void onResolve(entry.id, 'reject')}
                    className="rounded-full border border-red-500/20 px-4 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10"
                  >
                    Reject
                  </button>
                </div>
              ) : onResolve ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => void onResolve(entry.id, 'archive')}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-300"
                  >
                    Archive
                  </button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function isFeedbackTag(tag: string): tag is FeedbackTag {
  return (FEEDBACK_TAG_OPTIONS as readonly string[]).includes(tag);
}

export default function ProfilePage() {
  const [profileId, setProfileId] = useState<string | null>(null);
  const [desiredPerception, setDesiredPerception] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [toneGuardrails, setToneGuardrails] = useState('');
  const [entries, setEntries] = useState<MindModelEntry[]>([]);
  const [eventReflections, setEventReflections] = useState<EventReflection[]>([]);
  const [pendingBroadReflection, setPendingBroadReflection] = useState<ReflectionTurn | null>(null);
  const [metrics, setMetrics] = useState<WorkspaceMetrics | null>(null);
  const [editingStatements, setEditingStatements] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mirrorLoading, setMirrorLoading] = useState(false);
  const [mirrorAnalysis, setMirrorAnalysis] = useState<string | null>(null);
  const [mirrorError, setMirrorError] = useState<string | null>(null);

  useEffect(() => {
    async function loadWorkspace() {
      const result = await getMindModelWorkspace();
      if (result.success && result.data) {
        const profile = result.data.profile as ProfileData;
        setProfileId(profile?.id || null);
        setDesiredPerception(profile?.desired_perception || '');
        setTargetAudience(profile?.target_audience || '');
        setToneGuardrails(profile?.tone_guardrails || '');
        setEntries(result.data.entries || []);
        setEventReflections(result.data.eventReflections || []);
        setPendingBroadReflection(result.data.pendingBroadReflection || null);
        setMetrics(result.data.metrics || null);
        setError(null);
      } else {
        setError(getActionError(result, 'Failed to load mind model.'));
      }
      setLoading(false);
    }

    void loadWorkspace();
  }, []);

  const groupedEntries = useMemo(() => groupMindModelEntries(entries), [entries]);

  async function refreshWorkspace() {
    const result = await getMindModelWorkspace();
    if (result.success && result.data) {
      const profile = result.data.profile as ProfileData;
      setProfileId(profile?.id || null);
      setDesiredPerception(profile?.desired_perception || '');
      setTargetAudience(profile?.target_audience || '');
      setToneGuardrails(profile?.tone_guardrails || '');
      setEntries(result.data.entries || []);
      setEventReflections(result.data.eventReflections || []);
      setPendingBroadReflection(result.data.pendingBroadReflection || null);
      setMetrics(result.data.metrics || null);
      setError(null);
    } else {
      setError(getActionError(result, 'Failed to load mind model.'));
    }
  }

  async function handleSaveProfile() {
    setSaving(true);
    setSaved(false);
    setError(null);

    const result = await updateProfile({
      id: profileId || undefined,
      desired_perception: desiredPerception,
      target_audience: targetAudience,
      tone_guardrails: toneGuardrails,
    });

    setSaving(false);

    if (!result.success) {
      setError(getActionError(result, 'Failed to save profile.'));
      return;
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
    await refreshWorkspace();
  }

  async function handleAnalyze() {
    setMirrorLoading(true);
    setMirrorError(null);
    setMirrorAnalysis(null);

    const result = await analyzePersona();
    if (result.success && result.data) {
      setMirrorAnalysis(result.data);
    } else {
      setMirrorError(getActionError(result, 'Analysis failed.'));
    }

    setMirrorLoading(false);
  }

  async function handleResolveEntry(
    entryId: string,
    action: 'confirm' | 'reject' | 'archive',
    statement?: string
  ) {
    const result = await resolveMindModelEntry({ id: entryId, action, statement });
    if (!result.success) {
      throw new Error(getActionError(result, 'Failed to update entry.'));
    }

    await refreshWorkspace();
  }

  async function handleBroadReflectionAnswer(answer: string) {
    if (!pendingBroadReflection) {
      return;
    }

    const result = await answerReflectionTurn(pendingBroadReflection.id, answer);
    if (!result.success) {
      throw new Error(getActionError(result, 'Failed to save reflection.'));
    }

    setPendingBroadReflection('nextReflection' in result ? result.nextReflection || null : null);
    await refreshWorkspace();
  }

  async function handleBroadReflectionSkip() {
    if (!pendingBroadReflection) {
      return;
    }

    const result = await skipReflectionTurn(pendingBroadReflection.id);
    if (!result.success) {
      throw new Error(getActionError(result, 'Failed to skip reflection.'));
    }

    setPendingBroadReflection(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] p-6 text-zinc-100 sm:p-12">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-zinc-900 pb-8">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <BrainCircuit className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl font-medium tracking-tight">Mind Model</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                  Bootstrap your public voice here, but let the rest of the page become the living
                  model of your beliefs, lenses, aversions, current obsessions, and event POVs.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm font-medium">
              <Link href="/vault" className="text-zinc-500 transition-colors hover:text-zinc-300">
                Knowledge Vault
              </Link>
              <Link href="/review" className="text-zinc-500 transition-colors hover:text-zinc-300">
                Review Drafts
              </Link>
              <Link href="/" className="text-zinc-500 transition-colors hover:text-zinc-300">
                &larr; Capture
              </Link>
            </div>
          </div>
        </header>

        {pendingBroadReflection ? (
          <section className="mt-8">
            <ReflectionPromptCard
              reflection={pendingBroadReflection}
              title="Understand Me"
              description="This is the broader interview layer. It helps the system move from note retrieval toward worldview modeling."
              submitLabel="Update Mind Model"
              onSubmit={handleBroadReflectionAnswer}
              onSkip={handleBroadReflectionSkip}
            />
          </section>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-500">
            {error}
          </div>
        ) : null}

        {metrics ? (
          <section className="mt-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Suggestion Confirmed
              </p>
              <p className="mt-3 text-3xl font-medium text-zinc-100">
                {formatPercentage(metrics.suggestionConfirmationRate)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Draft Approval Rate
              </p>
              <p className="mt-3 text-3xl font-medium text-zinc-100">
                {formatPercentage(metrics.draftApprovalRate)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Average Edit Intensity
              </p>
              <p className="mt-3 text-3xl font-medium text-zinc-100">
                {formatPercentage(metrics.averageEditIntensity)}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Confirmed Entries
              </p>
              <p className="mt-3 text-3xl font-medium text-zinc-100">{metrics.confirmedEntryCount}</p>
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-8">
            <section className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/80">
                  <User className="h-4 w-4 text-zinc-400" />
                </div>
                <div>
                  <h2 className="text-lg font-medium">Bootstrap Voice</h2>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                    These fields seed generation early, but over time the confirmed mind model takes
                    precedence.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-300">Desired Public Perception</span>
                    <span className="mt-1 block text-xs text-zinc-600">
                      How do you want thoughtful peers to describe you?
                    </span>
                  </label>
                  <textarea
                    value={desiredPerception}
                    onChange={(event) => setDesiredPerception(event.target.value)}
                    placeholder="A sharp systems thinker who notices second-order effects and writes with conviction."
                    className="min-h-[110px] w-full resize-none rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-[15px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-800 focus:border-zinc-700"
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-300">Target Audience</span>
                    <span className="mt-1 block text-xs text-zinc-600">
                      Who are you really writing for when you compress a belief into a tweet?
                    </span>
                  </label>
                  <textarea
                    value={targetAudience}
                    onChange={(event) => setTargetAudience(event.target.value)}
                    placeholder="Technical founders, operators, and builders who care about leverage, incentives, and systems."
                    className="min-h-[110px] w-full resize-none rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-[15px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-800 focus:border-zinc-700"
                    spellCheck={false}
                  />
                </div>

                <div className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-300">Tone Guardrails</span>
                    <span className="mt-1 block text-xs text-zinc-600">
                      What should the system avoid even if the idea is directionally correct?
                    </span>
                  </label>
                  <textarea
                    value={toneGuardrails}
                    onChange={(event) => setToneGuardrails(event.target.value)}
                    placeholder="No performative hooks. No fake certainty. No shallow productivity framing. Keep it clean and compressed."
                    className="min-h-[110px] w-full resize-none rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-[15px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-800 focus:border-zinc-700"
                    spellCheck={false}
                  />
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveProfile()}
                    disabled={saving}
                    className={`inline-flex items-center gap-2.5 rounded-xl border px-6 py-3 text-sm font-semibold transition-all ${
                      saved
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : saving
                        ? 'cursor-not-allowed border-zinc-700 bg-zinc-800/50 text-zinc-500'
                        : 'border-zinc-100 bg-zinc-100 text-[#050505] hover:scale-105 hover:bg-white active:scale-95'
                    }`}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    {saving ? 'Saving...' : saved ? 'Saved' : 'Save Bootstrap Profile'}
                  </button>
                </div>
              </div>
            </section>

            <EntrySection
              title="Suggested Inferences Awaiting Confirmation"
              description="These are model guesses based on your notes, reflections, edits, and event takes. Confirm, edit-then-confirm, or reject them."
              entries={groupedEntries.suggestedEntries}
              editable
              onResolve={handleResolveEntry}
              editingStatements={editingStatements}
              setEditingStatements={setEditingStatements}
            />

            <EntrySection
              title="Confirmed Beliefs"
              description="These are the strongest worldview statements the generator should trust."
              entries={groupedEntries.confirmedBeliefs}
              onResolve={handleResolveEntry}
            />

            <EntrySection
              title="Recurring Lenses"
              description="These describe how you habitually interpret things: incentives, systems, leverage, timing, power, culture, or other lenses."
              entries={groupedEntries.recurringLenses}
              onResolve={handleResolveEntry}
            />

            <EntrySection
              title="Current Obsessions"
              description="What you are actively thinking about right now gets extra weight in generation."
              entries={groupedEntries.currentObsessions}
              onResolve={handleResolveEntry}
            />
          </div>

          <div className="space-y-8">
            <EntrySection
              title="Taste and Anti-Taste"
              description="The system needs to know both what feels right and what instantly feels fake."
              entries={[...groupedEntries.tasteLikes, ...groupedEntries.tasteAvoids]}
              onResolve={handleResolveEntry}
            />

            <EntrySection
              title="Voice Rules"
              description="These are high-priority constraints learned from your feedback and confirmed worldview."
              entries={groupedEntries.voiceRules}
              onResolve={handleResolveEntry}
            />

            <EntrySection
              title="Open Questions"
              description="Not every part of the system should be certain. These are unresolved tensions worth revisiting."
              entries={groupedEntries.openQuestions}
              onResolve={handleResolveEntry}
            />

            <EntrySection
              title="Recent Event POVs"
              description="Current events become usable only after they are translated into your own take."
              entries={groupedEntries.recentEventPovs}
              onResolve={handleResolveEntry}
            />

            <section className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
              <div className="mb-4">
                <h2 className="text-lg font-medium text-zinc-100">Recent Event Reflections</h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                  These are the underlying event records feeding recent POV entries.
                </p>
              </div>

              <div className="grid gap-3">
                {eventReflections.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 border-dashed p-4 text-sm text-zinc-600">
                    No recent event reflections yet. Add one from the capture page.
                  </div>
                ) : (
                  eventReflections.map((eventReflection) => (
                    <div key={eventReflection.id} className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                      <p className="text-sm font-medium text-zinc-100">{eventReflection.headline}</p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                        {eventReflection.source_summary}
                      </p>
                      {eventReflection.user_take ? (
                        <p className="mt-3 text-sm leading-relaxed text-zinc-300">
                          <span className="text-zinc-500">Your take:</span> {eventReflection.user_take}
                        </p>
                      ) : null}
                      {eventReflection.derived_thesis ? (
                        <p className="mt-3 text-sm leading-relaxed text-amber-300">
                          <span className="text-zinc-500">Derived thesis:</span> {eventReflection.derived_thesis}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
              <div className="mb-4">
                <h2 className="text-lg font-medium tracking-tight">
                  The Mirror <span className="text-sm font-normal text-zinc-500">(Persona Analysis)</span>
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Analyze your approved and opened drafts to see what public persona you are
                  actually projecting.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={mirrorLoading}
                className={`inline-flex items-center gap-2.5 rounded-xl border px-6 py-3 text-sm font-semibold transition-all ${
                  mirrorLoading
                    ? 'cursor-not-allowed border-violet-500/15 bg-violet-500/[0.08] text-zinc-400'
                    : 'border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-blue-500/15 text-violet-300 hover:from-violet-500/25 hover:to-blue-500/25'
                }`}
              >
                {mirrorLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {mirrorLoading ? 'Analyzing...' : 'Analyze My Public Persona'}
              </button>

              {mirrorError ? (
                <div className="mt-4 rounded-md border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-500">
                  {mirrorError}
                </div>
              ) : null}

              {mirrorAnalysis ? (
                <div className="relative mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8">
                  <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 opacity-50" />
                  <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200">
                    {mirrorAnalysis}
                  </div>
                </div>
              ) : null}
            </section>

            {metrics && metrics.rejectedByReason.length > 0 ? (
              <section className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-400" />
                  <h2 className="text-lg font-medium text-zinc-100">Top Rejection Reasons</h2>
                </div>
                <div className="grid gap-3">
                  {metrics.rejectedByReason.map((reason) => (
                    <div key={reason.tag} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                      <span className="text-sm text-zinc-300">
                        {isFeedbackTag(reason.tag) ? getFeedbackTagLabel(reason.tag) : formatEntryKind(reason.tag)}
                      </span>
                      <span className="text-sm font-medium text-zinc-500">{reason.count}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
