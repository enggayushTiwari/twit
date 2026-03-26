'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { deleteGeneratedTweet } from '../actions';
import {
  answerStartupReflectionTurn,
  deleteStartupMemoryEntry,
  getStartupWorkspace,
  saveStartupMemoryEntry,
  skipStartupReflectionTurn,
  updateStartupProfile,
} from './actions';
import ReflectionPromptCard from '../ReflectionPromptCard';
import { Loader2, Rocket, Save, Sparkles, Trash2 } from 'lucide-react';
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
  generation_mode: 'build' | 'startup';
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
    context_ref_type: 'build_memory',
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
  const [profileForm, setProfileForm] = useState({
    startup_name: '',
    one_liner: '',
    target_customer: '',
    painful_problem: '',
    transformation: '',
    positioning: '',
    proof_points: '',
    objections: '',
    language_guardrails: '',
  });
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
      setProfileForm({
        startup_name: result.data.profile?.startup_name || '',
        one_liner: result.data.profile?.one_liner || '',
        target_customer: result.data.profile?.target_customer || '',
        painful_problem: result.data.profile?.painful_problem || '',
        transformation: result.data.profile?.transformation || '',
        positioning: result.data.profile?.positioning || '',
        proof_points: result.data.profile?.proof_points || '',
        objections: result.data.profile?.objections || '',
        language_guardrails: result.data.profile?.language_guardrails || '',
      });
      setMemoryEntries(result.data.memoryEntries);
      setPendingReflection(result.data.pendingReflection);
      setRecentDrafts(result.data.recentDrafts);
      setLoading(false);
    }

    void loadWorkspace();
  }, []);

  async function refreshWorkspace() {
    const result = await getStartupWorkspace();
    if (!result.success || !result.data) {
      throw new Error(getActionError(result, 'Failed to refresh startup workspace.'));
    }

    setProfile(result.data.profile);
    setProfileForm({
      startup_name: result.data.profile?.startup_name || '',
      one_liner: result.data.profile?.one_liner || '',
      target_customer: result.data.profile?.target_customer || '',
      painful_problem: result.data.profile?.painful_problem || '',
      transformation: result.data.profile?.transformation || '',
      positioning: result.data.profile?.positioning || '',
      proof_points: result.data.profile?.proof_points || '',
      objections: result.data.profile?.objections || '',
      language_guardrails: result.data.profile?.language_guardrails || '',
    });
    setMemoryEntries(result.data.memoryEntries);
    setPendingReflection(result.data.pendingReflection);
    setRecentDrafts(result.data.recentDrafts);
  }

  useEffect(() => {
    function handleAutoGenerationCompleted() {
      void (async () => {
        const result = await getStartupWorkspace();
        if (!result.success || !result.data) {
          return;
        }

        setProfile(result.data.profile);
        setProfileForm({
          startup_name: result.data.profile?.startup_name || '',
          one_liner: result.data.profile?.one_liner || '',
          target_customer: result.data.profile?.target_customer || '',
          painful_problem: result.data.profile?.painful_problem || '',
          transformation: result.data.profile?.transformation || '',
          positioning: result.data.profile?.positioning || '',
          proof_points: result.data.profile?.proof_points || '',
          objections: result.data.profile?.objections || '',
          language_guardrails: result.data.profile?.language_guardrails || '',
        });
        setMemoryEntries(result.data.memoryEntries);
        setPendingReflection(result.data.pendingReflection);
        setRecentDrafts(result.data.recentDrafts);
      })();
    }

    window.addEventListener('autogen:completed', handleAutoGenerationCompleted);
    return () => window.removeEventListener('autogen:completed', handleAutoGenerationCompleted);
  }, []);

  function handleProfileFieldChange(
    field: keyof typeof profileForm,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const value = event.target.value;
    setProfileForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      id: profile?.id,
      startup_name: profileForm.startup_name,
      one_liner: profileForm.one_liner,
      target_customer: profileForm.target_customer,
      painful_problem: profileForm.painful_problem,
      transformation: profileForm.transformation,
      positioning: profileForm.positioning,
      proof_points: profileForm.proof_points,
      objections: profileForm.objections,
      language_guardrails: profileForm.language_guardrails,
    };

    setSavingProfile(true);
    setError(null);

    const result = await updateStartupProfile(payload);
    setSavingProfile(false);

    if (!result.success) {
      setError(getActionError(result, 'Failed to update startup profile.'));
      return;
    }

    await refreshWorkspace();
    setToast('Build profile updated.');
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
      setError(getActionError(result, 'Failed to save build memory.'));
      return;
    }

    setMemoryInput('');
    setMemoryEntries((previous) => [result.data.entry, ...previous].slice(0, 24));
    setPendingReflection((previous) => result.data?.reflection || previous);
    setLatestFocus(result.data.suggestion.communication_focus);
    setLatestSuggestedPoints(result.data.suggestion.suggested_points);
    setToast('Build memory saved.');
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
      const response = await fetch('/api/build/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate a build draft.');
      }

      await refreshWorkspace();
      setToast('Generated a build-in-public draft.');
      window.setTimeout(() => setToast(null), 2500);
    } catch (generationError) {
      const message =
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate a build draft.';
      setError(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteStartupMemory(entryId: string) {
    const previousEntries = memoryEntries;
    setMemoryEntries((current) => current.filter((entry) => entry.id !== entryId));
    setError(null);

    const result = await deleteStartupMemoryEntry(entryId);
    if (!result.success) {
      setMemoryEntries(previousEntries);
      setError(getActionError(result, 'Failed to delete build memory.'));
      return;
    }

    if (pendingReflection?.startup_memory_entry_id === entryId) {
      setPendingReflection(null);
    }

    setToast('Build memory deleted.');
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handleDeleteStartupDraft(tweetId: string) {
    const previousDrafts = recentDrafts;
    setRecentDrafts((current) => current.filter((draft) => draft.id !== tweetId));
    setError(null);

    const result = await deleteGeneratedTweet(tweetId);
    if (!result.success) {
      setRecentDrafts(previousDrafts);
      setError(getActionError(result, 'Failed to delete build draft.'));
      return;
    }

    setToast('Build draft deleted.');
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
    <div className="min-h-screen bg-[#050505] p-4 pb-24 text-zinc-100 sm:p-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="border-b border-zinc-900 pb-8">
          <div>
            <h1 className="text-2xl font-medium tracking-tight text-zinc-100">
              Build in Public Workspace
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500 sm:max-w-3xl">
              This is the shared build memory for what you are actively building. It combines
              startup thinking and project logs so the system can generate build-in-public posts
              without losing the product story.
            </p>
          </div>
        </header>

        {pendingReflection ? (
          <ReflectionPromptCard
            reflection={toReflectionCardInput(pendingReflection)}
            title="Build Follow-Up"
            description="This question is trying to make the build story clearer to outsiders, not just to you as the builder."
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
                  Build Profile
                </p>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Give the generator the minimum product context it needs before it starts turning
                  your build process into public-facing posts.
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
                value={profileForm.startup_name}
                onChange={(event) => handleProfileFieldChange('startup_name', event)}
                placeholder="Product or startup name"
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="one_liner"
                value={profileForm.one_liner}
                onChange={(event) => handleProfileFieldChange('one_liner', event)}
                placeholder="One-liner: what are you building in plain language?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="target_customer"
                value={profileForm.target_customer}
                onChange={(event) => handleProfileFieldChange('target_customer', event)}
                placeholder="Target customer"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="painful_problem"
                value={profileForm.painful_problem}
                onChange={(event) => handleProfileFieldChange('painful_problem', event)}
                placeholder="What painful problem are you solving?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="transformation"
                value={profileForm.transformation}
                onChange={(event) => handleProfileFieldChange('transformation', event)}
                placeholder="What changes for the user after using it?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="positioning"
                value={profileForm.positioning}
                onChange={(event) => handleProfileFieldChange('positioning', event)}
                placeholder="How should it be positioned?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="proof_points"
                value={profileForm.proof_points}
                onChange={(event) => handleProfileFieldChange('proof_points', event)}
                placeholder="Proof points, traction, examples"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="objections"
                value={profileForm.objections}
                onChange={(event) => handleProfileFieldChange('objections', event)}
                placeholder="What objection would a skeptical person raise?"
                className="min-h-[88px] resize-none rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
              />
              <textarea
                name="language_guardrails"
                value={profileForm.language_guardrails}
                onChange={(event) => handleProfileFieldChange('language_guardrails', event)}
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
                    Build Memory
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    Save product insights, project logs, pains, objections, proof, user language,
                    and GTM thoughts into one build memory lane.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateStartupDraft()}
                  disabled={generating}
                  className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 transition-colors hover:bg-violet-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {generating ? 'Generating...' : 'Generate Build Draft'}
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
                  placeholder="Capture something from the build: a project log, product insight, shipping note, objection, or customer pattern."
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
                {savingMemory ? 'Saving...' : 'Save Build Memory'}
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
                Recent Build Drafts
              </p>
              <div className="mt-4 grid gap-3">
                {recentDrafts.length === 0 ? (
                  <div className="rounded-xl border border-zinc-900 border-dashed px-4 py-6 text-sm text-zinc-600">
                    No build drafts yet. Generate one after you save a few build memories.
                  </div>
                ) : (
                  recentDrafts.slice(0, 4).map((draft) => (
                    <div key={draft.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
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
                        <button
                          type="button"
                          onClick={() => void handleDeleteStartupDraft(draft.id)}
                          className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                          title="Delete build draft"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
              Build Memory Log
            </p>
            <div className="mt-4 grid gap-3">
              {memoryEntries.length === 0 ? (
                <div className="rounded-xl border border-zinc-900 border-dashed px-4 py-6 text-sm text-zinc-600">
                  Save project logs, product insights, objections, and customer pain here to start
                  the build-in-public loop.
                </div>
              ) : (
                memoryEntries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500">
                        <span className="rounded-full border border-zinc-700 px-2 py-1 uppercase tracking-[0.12em]">
                          {getStartupMemoryKindLabel(entry.kind)}
                        </span>
                        {entry.metadata?.communication_focus ? (
                          <span>{entry.metadata.communication_focus}</span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteStartupMemory(entry.id)}
                        className="rounded-lg border border-zinc-800 p-2 text-zinc-500 transition-colors hover:border-red-500/40 hover:text-red-400"
                        title="Delete build memory"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
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
                It keeps build memory separate from the general vault, so the build generator only
                reasons over what you are actually building.
              </p>
              <p>
                It still uses your shared mind model as the worldview and taste filter, so build
                posts sound like you without dragging in unrelated general ideas.
              </p>
              <p>
                The follow-up questions are trying to make the build more legible to broader
                people: what shipped, who it is for, what painful problem it solves, what changed,
                and what objection a skeptic would raise.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
