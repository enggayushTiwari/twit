'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  answerStartupReflectionTurn,
  getStartupWorkspace,
  saveStartupMemoryEntry,
  skipStartupReflectionTurn,
  updateStartupProfile,
} from './actions';
import ReflectionPromptCard from '../ReflectionPromptCard';
import { Loader2, Rocket, Save, Sparkles } from 'lucide-react';
import {
  STARTUP_MEMORY_KINDS,
  getStartupMemoryKindLabel,
  type StartupMemoryEntry,
  type StartupMemoryKind,
  type StartupProfile,
  type StartupReflectionTurn,
} from '@/utils/startup';
import type { ReflectionTurn } from '@/utils/self-model';

type StartupDraftRecord = {
  id: string;
  content: string;
  status: string;
  generation_mode: 'startup';
  theses: string[] | null;
  alternates:
    | Array<{
        draft: string;
        thesis: string;
        why_it_fits: string;
        score?: number;
      }>
    | null;
  rationale: string | null;
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

function toReflectionCardInput(reflection: StartupReflectionTurn): ReflectionTurn {
  return {
    id: reflection.id,
    mode: 'capture_followup',
    prompt: reflection.prompt,
    answer: reflection.answer,
    context_ref_type: 'startup_memory',
    context_ref_id: reflection.startup_memory_entry_id,
    derived_entry_ids: [],
    metadata: {
      format: 'open',
      rationale: reflection.metadata?.rationale || '',
      stage: 'reflect',
    },
    created_at: reflection.created_at,
  };
}

export default function StartupWorkspacePage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingMemory, setSavingMemory] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [profile, setProfile] = useState<StartupProfile | null>(null);
  const [memoryEntries, setMemoryEntries] = useState<StartupMemoryEntry[]>([]);
  const [pendingReflection, setPendingReflection] = useState<StartupReflectionTurn | null>(null);
  const [recentDrafts, setRecentDrafts] = useState<StartupDraftRecord[]>([]);
  const [memoryKind, setMemoryKind] = useState<StartupMemoryKind>('product_insight');
  const [memoryInput, setMemoryInput] = useState('');
  const [latestFocus, setLatestFocus] = useState<string | null>(null);
  const [latestSuggestedPoints, setLatestSuggestedPoints] = useState<string[]>([]);

  useEffect(() => {
    async function loadWorkspace() {
      const result = await getStartupWorkspace();

      if (!result.success || !result.data) {
        setError(getActionError(result, 'Failed to load startup workspace.'));
        setLoading(false);
        return;
      }

      setProfile(result.data.profile);
      setMemoryEntries(result.data.memoryEntries);
      setPendingReflection(result.data.pendingReflection);
      setRecentDrafts(result.data.recentDrafts);
      setLoading(false);
    }

    void loadWorkspace();
  }, []);

  const form = useMemo(
    () => ({
      id: profile?.id || '',
      startup_name: profile?.startup_name || '',
      one_liner: profile?.one_liner || '',
      target_customer: profile?.target_customer || '',
      painful_problem: profile?.painful_problem || '',
      transformation: profile?.transformation || '',
      positioning: profile?.positioning || '',
      proof_points: profile?.proof_points || '',
      objections: profile?.objections || '',
      language_guardrails: profile?.language_guardrails || '',
    }),
    [profile]
  );

  async function refreshWorkspace() {
    const result = await getStartupWorkspace();
    if (!result.success || !result.data) {
      throw new Error(getActionError(result, 'Failed to refresh startup workspace.'));
    }

    setProfile(result.data.profile);
    setMemoryEntries(result.data.memoryEntries);
    setPendingReflection(result.data.pendingReflection);
    setRecentDrafts(result.data.recentDrafts);
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.id) {
      setError('Startup profile is missing.');
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload: StartupProfile = {
      id: profile.id,
      startup_name: String(formData.get('startup_name') || ''),
      one_liner: String(formData.get('one_liner') || ''),
      target_customer: String(formData.get('target_customer') || ''),
      painful_problem: String(formData.get('painful_problem') || ''),
      transformation: String(formData.get('transformation') || ''),
      positioning: String(formData.get('positioning') || ''),
      proof_points: String(formData.get('proof_points') || ''),
      objections: String(formData.get('objections') || ''),
      language_guardrails: String(formData.get('language_guardrails') || ''),
      updated_at: profile.updated_at,
    };

    setSavingProfile(true);
    setError(null);

    const result = await updateStartupProfile(payload);
    setSavingProfile(false);

    if (!result.success) {
      setError(getActionError(result, 'Failed to update startup profile.'));
      return;
    }

    setProfile((previous) =>
      previous
        ? {
            ...previous,
            ...payload,
            updated_at: new Date().toISOString(),
          }
        : previous
    );
    setToast('Startup profile updated.');
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handleSaveMemory() {
    if (!memoryInput.trim()) {
      return;
    }

    setSavingMemory(true);
    setError(null);
    const result = await saveStartupMemoryEntry(memoryInput, memoryKind);
    setSavingMemory(false);

    if (!result.success || !result.data) {
      setError(getActionError(result, 'Failed to save startup memory.'));
      return;
    }

    setMemoryInput('');
    setMemoryEntries((previous) => [result.data.entry, ...previous].slice(0, 24));
    setPendingReflection(result.data.reflection);
    setLatestFocus(result.data.suggestion.communication_focus);
    setLatestSuggestedPoints(result.data.suggestion.suggested_points);
    setToast('Startup memory saved.');
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handleStartupReflectionAnswer(answer: string) {
    if (!pendingReflection) {
      return;
    }

    const result = await answerStartupReflectionTurn(pendingReflection.id, answer);
    if (!result.success || !result.data) {
      throw new Error(getActionError(result, 'Failed to save startup reflection.'));
    }

    setPendingReflection(null);
    setLatestSuggestedPoints(result.data.suggestions);
    setMemoryEntries((previous) =>
      previous.map((entry) => (entry.id === result.data.updatedEntry.id ? result.data.updatedEntry : entry))
    );
  }

  async function handleStartupReflectionSkip() {
    if (!pendingReflection) {
      return;
    }

    const result = await skipStartupReflectionTurn(pendingReflection.id);
    if (!result.success) {
      throw new Error(getActionError(result, 'Failed to skip startup reflection.'));
    }

    setPendingReflection(null);
  }

  async function handleGenerateStartupDraft() {
    setGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/startup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate a startup draft.');
      }

      await refreshWorkspace();
      setToast('Generated a startup-specific draft.');
      window.setTimeout(() => setToast(null), 2500);
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate a startup draft.';
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] text-zinc-100">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] px-6 py-12 text-zinc-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="border-b border-zinc-900 pb-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-medium tracking-tight text-zinc-100">
                Startup Workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                This is a separate memory lane for the startup you are actively building. It learns
                how to explain the product to broader people, then generates startup-specific tweets
                without mixing in the general vault.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm font-medium">
              <Link href="/" className="text-zinc-500 transition-colors hover:text-zinc-300">
                Capture
              </Link>
              <Link href="/profile" className="text-zinc-500 transition-colors hover:text-zinc-300">
                Mind Model
              </Link>
              <Link href="/review" className="text-zinc-500 transition-colors hover:text-zinc-300">
                Review Drafts
              </Link>
            </div>
          </div>
        </header>

        {pendingReflection ? (
          <ReflectionPromptCard
            reflection={toReflectionCardInput(pendingReflection)}
            title="Startup Follow-Up"
            description="This question is trying to make the startup clearer to outsiders, not just to you as the builder."
            submitLabel="Save Clarification"
            onSubmit={handleStartupReflectionAnswer}
            onSkip={handleStartupReflectionSkip}
          />
        ) : null}

        {toast ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-400">
            {toast}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            onSubmit={(event) => void handleProfileSave(event)}
            className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Startup Profile
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Give the generator the minimum product context it needs before it starts trying to
                  communicate the startup in public.
                </p>
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <input
                name="startup_name"
                defaultValue={form.startup_name}
                placeholder="Startup name"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="one_liner"
                defaultValue={form.one_liner}
                placeholder="One-liner: what is this startup in plain language?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="target_customer"
                defaultValue={form.target_customer}
                placeholder="Target customer"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="painful_problem"
                defaultValue={form.painful_problem}
                placeholder="What painful problem are you solving?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="transformation"
                defaultValue={form.transformation}
                placeholder="What changes for the user after using it?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="positioning"
                defaultValue={form.positioning}
                placeholder="How should it be positioned?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="proof_points"
                defaultValue={form.proof_points}
                placeholder="Proof points, traction, examples"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="objections"
                defaultValue={form.objections}
                placeholder="What objection would a skeptical person raise?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="language_guardrails"
                defaultValue={form.language_guardrails}
                placeholder="Language guardrails: what jargon should it avoid, what words should it prefer?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
            </div>
          </form>

          <div className="space-y-6">
            <section className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Startup Memory
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    Save product insights, pains, objections, proof, user language, and GTM thoughts
                    into a dedicated startup memory.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateStartupDraft()}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 transition-colors hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? 'Generating...' : 'Generate Startup Draft'}
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                <select
                  value={memoryKind}
                  onChange={(event) => setMemoryKind(event.target.value as StartupMemoryKind)}
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-medium text-zinc-200 outline-none transition-colors focus:border-zinc-600"
                >
                  {STARTUP_MEMORY_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {getStartupMemoryKindLabel(kind)}
                    </option>
                  ))}
                </select>

                <textarea
                  value={memoryInput}
                  onChange={(event) => setMemoryInput(event.target.value)}
                  placeholder="Capture a startup-specific thought. Example: users don’t need more dashboards, they need one place that turns scattered product signals into a clear next action."
                  className="min-h-[160px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
                  spellCheck={false}
                />
              </div>

              <button
                type="button"
                onClick={() => void handleSaveMemory()}
                disabled={savingMemory || !memoryInput.trim()}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingMemory ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                {savingMemory ? 'Saving...' : 'Save Startup Memory'}
              </button>

              {latestFocus || latestSuggestedPoints.length > 0 ? (
                <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Latest Communication Read
                  </p>
                  {latestFocus ? (
                    <p className="mt-2 text-sm leading-relaxed text-zinc-300">{latestFocus}</p>
                  ) : null}
                  {latestSuggestedPoints.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {latestSuggestedPoints.map((point) => (
                        <span
                          key={point}
                          className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400"
                        >
                          {point}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Recent Startup Drafts
              </p>
              <div className="mt-4 grid gap-3">
                {recentDrafts.length === 0 ? (
                  <div className="rounded-xl border border-zinc-900 border-dashed px-4 py-6 text-sm text-zinc-600">
                    No startup drafts yet. Generate one after you save a few startup memories.
                  </div>
                ) : (
                  recentDrafts.slice(0, 4).map((draft) => (
                    <div key={draft.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="rounded-full border border-zinc-700 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-zinc-500">
                          {draft.status.toLowerCase().replace(/_/g, ' ')}
                        </span>
                        <span className="text-xs text-zinc-600">
                          {new Date(draft.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-zinc-300">{draft.content}</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Startup Memory Log
            </p>
            <div className="mt-4 grid gap-3">
              {memoryEntries.length === 0 ? (
                <div className="rounded-xl border border-zinc-900 border-dashed px-4 py-6 text-sm text-zinc-600">
                  Save product insights, objections, and customer pain here to start the startup
                  communication loop.
                </div>
              ) : (
                memoryEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                      <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                        {getStartupMemoryKindLabel(entry.kind)}
                      </span>
                      {entry.metadata?.communication_focus ? (
                        <span>{entry.metadata.communication_focus}</span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-200">{entry.content}</p>
                    {entry.metadata?.suggested_points && entry.metadata.suggested_points.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {entry.metadata.suggested_points.map((point) => (
                          <span
                            key={`${entry.id}-${point}`}
                            className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-900 bg-zinc-950/70 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              What This Mode Does
            </p>
            <div className="mt-4 grid gap-3 text-sm leading-relaxed text-zinc-400">
              <p>
                It keeps startup memory separate from the general vault, so the startup generator
                only reasons over product-specific material.
              </p>
              <p>
                It still uses your shared mind model as the worldview and taste filter, so startup
                tweets sound like you without dragging in unrelated general ideas.
              </p>
              <p>
                The follow-up questions are trying to make the startup more legible to broader
                people: who it is for, what painful problem it solves, what changes after using it,
                and what objection a skeptic would raise.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
