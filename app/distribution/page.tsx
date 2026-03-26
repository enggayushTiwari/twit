'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  deleteConversationOpportunity,
  deleteNarrativePillar,
  deleteProofAsset,
  deleteTargetAccount,
  getDistributionWorkspace,
  importConversationOpportunities,
  saveDistributionOutcome,
  saveNarrativePillar,
  saveProofAsset,
  saveTargetAccount,
  updateCompanyImageProfile,
} from './actions';
import {
  getConversationActionLabel,
  getDraftKindLabel,
  getProofAssetKindLabel,
  type CompanyImageProfile,
  type ConversationOpportunity,
  type DistributionOutcome,
  type NarrativePillar,
  type ProofAsset,
  type ProofAssetKind,
  type TargetAccount,
} from '@/utils/distribution';
import {
  Loader2,
  MessageSquareQuote,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';

type DistributionDraftRecord = {
  id: string;
  content: string;
  status: string;
  generation_mode?: string;
  draft_kind?: 'original_post' | 'reply' | 'quote_post';
  pillar_label?: string | null;
  source_conversation_id?: string | null;
  post_archetype?: string | null;
  surface_intent?: string | null;
  created_at: string;
};

type WorkspaceSummary = {
  impressions: number;
  profileVisits: number;
  followsGained: number;
  bookmarks: number;
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

export default function DistributionPage() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [importingConversation, setImportingConversation] = useState(false);
  const [generatingForConversation, setGeneratingForConversation] = useState<string | null>(null);
  const [savingOutcomeId, setSavingOutcomeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [profile, setProfile] = useState<CompanyImageProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
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
  });
  const [pillars, setPillars] = useState<NarrativePillar[]>([]);
  const [proofAssets, setProofAssets] = useState<ProofAsset[]>([]);
  const [targetAccounts, setTargetAccounts] = useState<TargetAccount[]>([]);
  const [conversationOpportunities, setConversationOpportunities] = useState<ConversationOpportunity[]>([]);
  const [recentDrafts, setRecentDrafts] = useState<DistributionDraftRecord[]>([]);
  const [recentOutcomes, setRecentOutcomes] = useState<DistributionOutcome[]>([]);
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);

  const [pillarForm, setPillarForm] = useState({ label: '', description: '', priority: 2 });
  const [proofForm, setProofForm] = useState({
    kind: 'screenshot' as ProofAssetKind,
    title: '',
    content: '',
    assetUrl: '',
    proofStrength: 3,
  });
  const [targetForm, setTargetForm] = useState({
    handle: '',
    displayName: '',
    reason: '',
    priority: 2,
    monitoringNotes: '',
  });
  const [conversationForm, setConversationForm] = useState({ sourceUrl: '', pastedText: '' });
  const [outcomeForms, setOutcomeForms] = useState<
    Record<string, { impressions: string; likes: string; replies: string; reposts: string; bookmarks: string; profileVisits: string; followsGained: string; linkClicks: string; notes: string }>
  >({});

  async function refreshWorkspace() {
    const result = await getDistributionWorkspace();
    if (!result.success || !result.data) {
      throw new Error(getActionError(result, 'Failed to load distribution workspace.'));
    }

    setProfile(result.data.profile);
    setProfileForm({
      company_name: result.data.profile?.company_name || '',
      known_for: result.data.profile?.known_for || '',
      who_it_helps: result.data.profile?.who_it_helps || '',
      painful_problem: result.data.profile?.painful_problem || '',
      proof_points: result.data.profile?.proof_points || '',
      objection_patterns: result.data.profile?.objection_patterns || '',
      positioning_statements: result.data.profile?.positioning_statements || '',
      bio_direction: result.data.profile?.bio_direction || '',
      header_concept: result.data.profile?.header_concept || '',
      pinned_post_strategy: result.data.profile?.pinned_post_strategy || '',
      link_intent: result.data.profile?.link_intent || '',
    });
    setPillars(result.data.pillars);
    setProofAssets(result.data.proofAssets);
    setTargetAccounts(result.data.targetAccounts);
    setConversationOpportunities(result.data.conversationOpportunities);
    setRecentDrafts(result.data.recentDrafts as DistributionDraftRecord[]);
    setRecentOutcomes(result.data.recentOutcomes);
    setSummary({
      impressions: result.data.summary?.impressions ?? 0,
      profileVisits: result.data.summary?.profileVisits ?? 0,
      followsGained: result.data.summary?.followsGained ?? 0,
      bookmarks: result.data.summary?.bookmarks ?? 0,
    });
  }

  useEffect(() => {
    void (async () => {
      try {
        await refreshWorkspace();
      } catch (workspaceError) {
        setError(
          workspaceError instanceof Error
            ? workspaceError.message
            : 'Failed to load distribution workspace.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const opportunitiesByStatus = useMemo(
    () => ({
      open: conversationOpportunities.filter((item) => item.status === 'new'),
      used: conversationOpportunities.filter((item) => item.status !== 'new'),
    }),
    [conversationOpportunities]
  );

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setError(null);
    const result = await updateCompanyImageProfile({ id: profile?.id, ...profileForm });
    setSavingProfile(false);

    if (!result.success) {
      setError(getActionError(result, 'Failed to save company image profile.'));
      return;
    }

    await refreshWorkspace();
    setToast('Company image updated.');
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handlePillarSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await saveNarrativePillar(pillarForm);
    if (!result.success) {
      setError(getActionError(result, 'Failed to save pillar.'));
      return;
    }

    setPillarForm({ label: '', description: '', priority: 2 });
    await refreshWorkspace();
    setToast('Narrative pillar saved.');
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handleProofSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await saveProofAsset(proofForm);
    if (!result.success) {
      setError(getActionError(result, 'Failed to save proof asset.'));
      return;
    }

    setProofForm({
      kind: 'screenshot',
      title: '',
      content: '',
      assetUrl: '',
      proofStrength: 3,
    });
    await refreshWorkspace();
    setToast('Proof asset saved.');
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handleTargetSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const result = await saveTargetAccount(targetForm);
    if (!result.success) {
      setError(getActionError(result, 'Failed to save target account.'));
      return;
    }

    setTargetForm({
      handle: '',
      displayName: '',
      reason: '',
      priority: 2,
      monitoringNotes: '',
    });
    await refreshWorkspace();
    setToast('Target account saved.');
    window.setTimeout(() => setToast(null), 2500);
  }

  async function handleConversationImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setImportingConversation(true);
    setError(null);
    const result = await importConversationOpportunities(conversationForm);
    setImportingConversation(false);

    if (!result.success) {
      setError(getActionError(result, 'Failed to import conversations.'));
      return;
    }

    setConversationForm({ sourceUrl: '', pastedText: '' });
    await refreshWorkspace();
    setToast(result.message || 'Conversation opportunities imported.');
    window.setTimeout(() => setToast(null), 2800);
  }

  async function handleGenerateConversationDraft(
    conversationId: string,
    draftKind: 'reply' | 'quote_post'
  ) {
    setGeneratingForConversation(conversationId + draftKind);
    setError(null);

    try {
      const response = await fetch('/api/distribution/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftKind,
          conversationOpportunityId: conversationId,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate distribution draft.');
      }

      await refreshWorkspace();
      setToast(
        draftKind === 'reply' ? 'Reply draft added to review.' : 'Quote-post draft added to review.'
      );
      window.setTimeout(() => setToast(null), 2800);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : 'Failed to generate distribution draft.'
      );
    } finally {
      setGeneratingForConversation(null);
    }
  }

  async function handleOutcomeSave(tweetId: string) {
    const form = outcomeForms[tweetId];
    if (!form) {
      return;
    }

    setSavingOutcomeId(tweetId);
    setError(null);

    const result = await saveDistributionOutcome({
      generatedTweetId: tweetId,
      outcomeKind: 'performance_update',
      impressions: form.impressions ? Number(form.impressions) : null,
      likes: form.likes ? Number(form.likes) : null,
      replies: form.replies ? Number(form.replies) : null,
      reposts: form.reposts ? Number(form.reposts) : null,
      bookmarks: form.bookmarks ? Number(form.bookmarks) : null,
      profileVisits: form.profileVisits ? Number(form.profileVisits) : null,
      followsGained: form.followsGained ? Number(form.followsGained) : null,
      linkClicks: form.linkClicks ? Number(form.linkClicks) : null,
      notes: form.notes,
    });

    setSavingOutcomeId(null);

    if (!result.success) {
      setError(getActionError(result, 'Failed to save outcome.'));
      return;
    }

    await refreshWorkspace();
    setToast('Distribution outcome saved.');
    window.setTimeout(() => setToast(null), 2500);
  }

  return (
    <main className="min-h-screen bg-[#050505] text-zinc-100 px-6 py-10 pb-28 sm:pb-14">
      <div className="max-w-6xl mx-auto space-y-8">
        <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
                <ShieldCheck className="w-3.5 h-3.5" />
                Distribution OS
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-50">
                Grow company image, not just output volume
              </h1>
            </div>
            {summary ? <div className="text-sm text-zinc-400">{summary.impressions} impressions · {summary.profileVisits} profile visits · {summary.followsGained} follows</div> : null}
          </div>
          {loading ? <div className="mt-4 flex items-center gap-2 text-zinc-400"><Loader2 className="w-4 h-4 animate-spin" />Loading...</div> : null}
          {error ? <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div> : null}
          {toast ? <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{toast}</div> : null}
        </section>

        <form onSubmit={(event) => void handleProfileSave(event)} className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-zinc-50">Company image</h2>
            <p className="mt-1 text-sm text-zinc-400">This becomes the strategic memory the generators should prioritize.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {([
              ['company_name', 'Company name'],
              ['known_for', 'What should the company be known for?'],
              ['who_it_helps', 'Who does it help?'],
              ['painful_problem', 'What painful problem does it solve?'],
              ['proof_points', 'Strongest proof points'],
              ['objection_patterns', 'Common objections'],
              ['positioning_statements', 'Positioning statements'],
              ['bio_direction', 'Profile bio direction'],
              ['header_concept', 'Header concept'],
              ['pinned_post_strategy', 'Pinned post strategy'],
              ['link_intent', 'Profile CTA / link intent'],
            ] as const).map(([field, label]) => (
              <label key={field} className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-300">{label}</span>
                <textarea
                  value={profileForm[field]}
                  onChange={(event) => setProfileForm((previous) => ({ ...previous, [field]: event.target.value }))}
                  className="min-h-[86px] w-full resize-none rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600"
                />
              </label>
            ))}
          </div>
          <button type="submit" disabled={savingProfile} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60">
            {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save company image
          </button>
        </form>

        <section className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Narrative pillars</h2>
              <p className="mt-1 text-sm text-zinc-400">Every draft should ladder up to one of these.</p>
            </div>

            <div className="mt-4 space-y-3">
              {pillars.map((pillar) => (
                <div key={pillar.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">{pillar.label}</div>
                      <div className="mt-1 text-sm text-zinc-400">{pillar.description}</div>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                        Priority {pillar.priority}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteNarrativePillar(pillar.id).then(refreshWorkspace).catch(() => {})}
                      className="text-zinc-500 transition-colors hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={(event) => void handlePillarSave(event)} className="mt-5 space-y-3">
              <input
                value={pillarForm.label}
                onChange={(event) =>
                  setPillarForm((previous) => ({ ...previous, label: event.target.value }))
                }
                placeholder="Add pillar label"
                className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600"
              />
              <textarea
                value={pillarForm.description}
                onChange={(event) =>
                  setPillarForm((previous) => ({ ...previous, description: event.target.value }))
                }
                placeholder="What should this pillar cover?"
                className="min-h-[92px] w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600"
              />
              <input
                type="number"
                min={1}
                max={3}
                value={pillarForm.priority}
                onChange={(event) =>
                  setPillarForm((previous) => ({
                    ...previous,
                    priority: Number(event.target.value) || 2,
                  }))
                }
                className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500"
              >
                <Sparkles className="w-4 h-4" />
                Add pillar
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Target accounts</h2>
              <p className="mt-1 text-sm text-zinc-400">Who matters for qualified reach in your niche?</p>
            </div>

            <div className="mt-4 space-y-3">
              {targetAccounts.map((account) => (
                <div key={account.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-zinc-100">
                        @{account.handle}
                        {account.display_name ? ` · ${account.display_name}` : ''}
                      </div>
                      <div className="mt-1 text-sm text-zinc-400">{account.reason}</div>
                      {account.monitoring_notes ? (
                        <div className="mt-2 text-xs text-zinc-500">{account.monitoring_notes}</div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void deleteTargetAccount(account.id).then(refreshWorkspace).catch(() => {})}
                      className="text-zinc-500 transition-colors hover:text-red-300"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={(event) => void handleTargetSave(event)} className="mt-5 space-y-3">
              <input value={targetForm.handle} onChange={(event) => setTargetForm((previous) => ({ ...previous, handle: event.target.value }))} placeholder="@handle" className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <input value={targetForm.displayName} onChange={(event) => setTargetForm((previous) => ({ ...previous, displayName: event.target.value }))} placeholder="Display name" className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <textarea value={targetForm.reason} onChange={(event) => setTargetForm((previous) => ({ ...previous, reason: event.target.value }))} placeholder="Why does this account matter?" className="min-h-[90px] w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <textarea value={targetForm.monitoringNotes} onChange={(event) => setTargetForm((previous) => ({ ...previous, monitoringNotes: event.target.value }))} placeholder="What kind of conversation should we watch from them?" className="min-h-[82px] w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <button type="submit" className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500">
                <TrendingUp className="w-4 h-4" />
                Save target account
              </button>
            </form>
          </section>
        </section>

        <section className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Proof library</h2>
              <p className="mt-1 text-sm text-zinc-400">Give the system evidence so it stops sounding abstract.</p>
            </div>

            <form onSubmit={(event) => void handleProofSave(event)} className="mt-5 space-y-3">
              <select value={proofForm.kind} onChange={(event) => setProofForm((previous) => ({ ...previous, kind: event.target.value as ProofAssetKind }))} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600">
                {(['screenshot', 'demo', 'metric', 'customer_quote', 'product_change'] as ProofAssetKind[]).map((kind) => (
                  <option key={kind} value={kind}>
                    {getProofAssetKindLabel(kind)}
                  </option>
                ))}
              </select>
              <input value={proofForm.title} onChange={(event) => setProofForm((previous) => ({ ...previous, title: event.target.value }))} placeholder="Proof title" className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <textarea value={proofForm.content} onChange={(event) => setProofForm((previous) => ({ ...previous, content: event.target.value }))} placeholder="What is the proof? Metric, quote, demo result, screenshot description..." className="min-h-[96px] w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <input value={proofForm.assetUrl} onChange={(event) => setProofForm((previous) => ({ ...previous, assetUrl: event.target.value }))} placeholder="Optional asset URL" className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <input type="number" min={1} max={5} value={proofForm.proofStrength} onChange={(event) => setProofForm((previous) => ({ ...previous, proofStrength: Number(event.target.value) || 3 }))} className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <button type="submit" className="inline-flex items-center gap-2 rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500">
                <Save className="w-4 h-4" />
                Save proof
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {proofAssets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{getProofAssetKindLabel(asset.kind)} · strength {asset.proof_strength}/5</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">{asset.title}</div>
                      <div className="mt-2 text-sm text-zinc-400">{asset.content}</div>
                    </div>
                    <button type="button" onClick={() => void deleteProofAsset(asset.id).then(refreshWorkspace).catch(() => {})} className="text-zinc-500 transition-colors hover:text-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Conversation inbox</h2>
              <p className="mt-1 text-sm text-zinc-400">Import X URLs, searches, profiles, or pasted threads cheaply, then draft replies and quote posts from them.</p>
            </div>

            <form onSubmit={(event) => void handleConversationImport(event)} className="mt-5 space-y-3">
              <input value={conversationForm.sourceUrl} onChange={(event) => setConversationForm((previous) => ({ ...previous, sourceUrl: event.target.value }))} placeholder="Paste an X tweet/search/profile URL" className="w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <textarea value={conversationForm.pastedText} onChange={(event) => setConversationForm((previous) => ({ ...previous, pastedText: event.target.value }))} placeholder="Or paste tweet text / thread text manually" className="min-h-[120px] w-full rounded-2xl border border-zinc-800 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
              <button type="submit" disabled={importingConversation} className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60">
                {importingConversation ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquareQuote className="w-4 h-4" />}
                Import conversation opportunities
              </button>
            </form>

            <div className="mt-6 space-y-4">
              {opportunitiesByStatus.open.map((opportunity) => (
                <div key={opportunity.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                    <span>{opportunity.source_type.replace(/_/g, ' ')}</span>
                    <span>·</span>
                    <span>{getConversationActionLabel(opportunity.recommended_action)}</span>
                    {opportunity.author_handle ? (<><span>·</span><span>@{opportunity.author_handle}</span></>) : null}
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-200">{opportunity.content}</p>
                  {opportunity.why_it_matters ? <p className="mt-3 text-sm text-zinc-400">{opportunity.why_it_matters}</p> : null}
                  {opportunity.topic_tags.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {opportunity.topic_tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => void handleGenerateConversationDraft(opportunity.id, 'reply')} disabled={generatingForConversation === opportunity.id + 'reply'} className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60">
                      {generatingForConversation === opportunity.id + 'reply' ? 'Generating...' : 'Draft reply'}
                    </button>
                    <button type="button" onClick={() => void handleGenerateConversationDraft(opportunity.id, 'quote_post')} disabled={generatingForConversation === opportunity.id + 'quote_post'} className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-500">
                      {generatingForConversation === opportunity.id + 'quote_post' ? 'Generating...' : 'Draft quote post'}
                    </button>
                    <button type="button" onClick={() => void deleteConversationOpportunity(opportunity.id).then(refreshWorkspace).catch(() => {})} className="rounded-full border border-red-500/20 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/10">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Recent distribution drafts</h2>
              <p className="mt-1 text-sm text-zinc-400">Log what happened after posting so the system learns what earns qualified reach.</p>
            </div>

            <div className="mt-5 space-y-4">
              {recentDrafts.map((draft) => {
                const form = outcomeForms[draft.id] || {
                  impressions: '',
                  likes: '',
                  replies: '',
                  reposts: '',
                  bookmarks: '',
                  profileVisits: '',
                  followsGained: '',
                  linkClicks: '',
                  notes: '',
                };

                return (
                  <div key={draft.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.16em] text-zinc-500">
                      <span>{draft.draft_kind ? getDraftKindLabel(draft.draft_kind) : 'Draft'}</span>
                      {draft.pillar_label ? (<><span>·</span><span>{draft.pillar_label}</span></>) : null}
                      {draft.post_archetype ? (<><span>·</span><span>{draft.post_archetype.replace(/_/g, ' ')}</span></>) : null}
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-200">{draft.content}</p>
                    <p className="mt-2 text-xs text-zinc-500">{formatDate(draft.created_at)} · {draft.status}</p>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {([
                        ['impressions', 'Impressions'],
                        ['likes', 'Likes'],
                        ['replies', 'Replies'],
                        ['reposts', 'Reposts'],
                        ['bookmarks', 'Bookmarks'],
                        ['profileVisits', 'Profile visits'],
                        ['followsGained', 'Follows gained'],
                        ['linkClicks', 'Link clicks'],
                      ] as const).map(([key, label]) => (
                        <label key={key} className="block">
                          <span className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{label}</span>
                          <input value={form[key]} onChange={(event) => setOutcomeForms((previous) => ({ ...previous, [draft.id]: { ...form, [key]: event.target.value } }))} className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
                        </label>
                      ))}
                    </div>
                    <textarea value={form.notes} onChange={(event) => setOutcomeForms((previous) => ({ ...previous, [draft.id]: { ...form, notes: event.target.value } }))} placeholder="What did this teach us about qualified reach or company image?" className="mt-3 min-h-[82px] w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-zinc-600" />
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button type="button" onClick={() => void handleOutcomeSave(draft.id)} disabled={savingOutcomeId === draft.id} className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-950 transition-opacity hover:opacity-90 disabled:opacity-60">
                        {savingOutcomeId === draft.id ? 'Saving...' : 'Save outcome'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
            <div>
              <h2 className="text-xl font-semibold text-zinc-50">Recent outcomes</h2>
              <p className="mt-1 text-sm text-zinc-400">The latest signals feeding the ranking system.</p>
            </div>

            <div className="mt-5 space-y-3">
              {recentOutcomes.map((outcome) => (
                <div key={outcome.id} className="rounded-2xl border border-zinc-800 bg-black/30 p-4">
                  <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">{outcome.outcome_kind.replace(/_/g, ' ')} · {formatDate(outcome.created_at)}</div>
                  <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-zinc-300">
                    <div>Impressions: {outcome.impressions ?? '—'}</div>
                    <div>Profile visits: {outcome.profile_visits ?? '—'}</div>
                    <div>Follows: {outcome.follows_gained ?? '—'}</div>
                    <div>Bookmarks: {outcome.bookmarks ?? '—'}</div>
                  </div>
                  {outcome.notes ? <p className="mt-3 text-sm text-zinc-400">{outcome.notes}</p> : null}
                </div>
              ))}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
