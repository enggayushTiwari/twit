'use client';

import { useState, useEffect } from 'react';
import { getProfile, updateProfile, analyzePersona } from '../actions';
import Link from 'next/link';
import { Loader2, Save, CheckCircle2, User, Sparkles } from 'lucide-react';

export default function ProfilePage() {
    const [profileId, setProfileId] = useState<string | null>(null);
    const [desiredPerception, setDesiredPerception] = useState('');
    const [targetAudience, setTargetAudience] = useState('');
    const [toneGuardrails, setToneGuardrails] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mirrorLoading, setMirrorLoading] = useState(false);
    const [mirrorAnalysis, setMirrorAnalysis] = useState<string | null>(null);
    const [mirrorError, setMirrorError] = useState<string | null>(null);

    useEffect(() => {
        async function loadProfile() {
            const result = await getProfile();
            if (result.success && result.data) {
                setProfileId(result.data.id);
                setDesiredPerception(result.data.desired_perception || '');
                setTargetAudience(result.data.target_audience || '');
                setToneGuardrails(result.data.tone_guardrails || '');
            }
            setLoading(false);
        }
        loadProfile();
    }, []);

    const handleSave = async () => {
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

        if (result.success) {
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } else {
            setError(result.error || 'Failed to save profile.');
        }
    };

    const handleAnalyze = async () => {
        setMirrorLoading(true);
        setMirrorError(null);
        setMirrorAnalysis(null);

        const result = await analyzePersona();

        if (result.success && result.data) {
            setMirrorAnalysis(result.data);
        } else {
            setMirrorError(result.error || 'Analysis failed.');
        }
        setMirrorLoading(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] text-zinc-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col p-6 sm:p-12">
            <header className="max-w-3xl border-b border-zinc-900 pb-8 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                            <User className="w-4 h-4 text-amber-400" />
                        </div>
                        <h1 className="text-2xl font-medium tracking-tight">Define Persona</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/vault" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            Knowledge Vault
                        </Link>
                        <Link href="/review" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            Review Drafts
                        </Link>
                        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            &larr; Capture
                        </Link>
                    </div>
                </div>
                <p className="text-zinc-500 mt-3 leading-relaxed">
                    Define the psychological baseline. The generation engine will filter all raw ideas through this specific lens.
                </p>
            </header>

            <div className="max-w-3xl space-y-8">
                {/* Desired Perception */}
                <div className="space-y-3">
                    <label className="block">
                        <span className="text-sm font-medium text-zinc-300">Desired Public Perception</span>
                        <span className="block text-xs text-zinc-600 mt-1">
                            How do you want your audience to describe you?
                        </span>
                    </label>
                    <textarea
                        value={desiredPerception}
                        onChange={(e) => setDesiredPerception(e.target.value)}
                        placeholder="e.g., A pragmatic AI builder reverse-engineering complex systems. Someone who cuts through the hype and focuses on actual utility and architecture."
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-zinc-200 text-[15px] leading-relaxed outline-none resize-none min-h-[120px] placeholder:text-zinc-800 focus:border-zinc-700 transition-colors"
                        spellCheck={false}
                    />
                </div>

                {/* Target Audience */}
                <div className="space-y-3">
                    <label className="block">
                        <span className="text-sm font-medium text-zinc-300">Target Audience</span>
                        <span className="block text-xs text-zinc-600 mt-1">
                            Who exactly are you writing for? Be specific about their status and interests.
                        </span>
                    </label>
                    <textarea
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        placeholder="e.g., Other technical founders, software engineers, and people interested in AI automation. Peer-to-peer communication, not talking down to beginners."
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-zinc-200 text-[15px] leading-relaxed outline-none resize-none min-h-[120px] placeholder:text-zinc-800 focus:border-zinc-700 transition-colors"
                        spellCheck={false}
                    />
                </div>

                {/* Tone Guardrails */}
                <div className="space-y-3">
                    <label className="block">
                        <span className="text-sm font-medium text-zinc-300">Tone Guardrails</span>
                        <span className="block text-xs text-zinc-600 mt-1">
                            What are your absolute "Do Nots" for formatting and style?
                        </span>
                    </label>
                    <textarea
                        value={toneGuardrails}
                        onChange={(e) => setToneGuardrails(e.target.value)}
                        placeholder="e.g., Highly analytical and sharp. Use systems-thinking analogies (like database schemas or racing telemetry). NO thread-boi hooks. NO emojis. Keep sentences short."
                        className="w-full bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-zinc-200 text-[15px] leading-relaxed outline-none resize-none min-h-[120px] placeholder:text-zinc-800 focus:border-zinc-700 transition-colors"
                        spellCheck={false}
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="bg-red-950/30 text-red-500 p-4 rounded-md border border-red-900/50 text-sm">
                        {error}
                    </div>
                )}

                {/* Save Button */}
                <div className="flex items-center gap-4 pt-2">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed border ${saved
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : saving
                                    ? 'bg-zinc-800/50 border-zinc-700 text-zinc-500'
                                    : 'bg-zinc-100 border-zinc-100 text-[#050505] hover:bg-white hover:scale-105 active:scale-95'
                            }`}
                    >
                        {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : saved ? (
                            <CheckCircle2 className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        {saving ? 'Saving...' : saved ? 'Profile Saved!' : 'Save Profile'}
                    </button>
                </div>

                <hr className="border-zinc-900 my-10" />

                {/* ====== THE MIRROR ====== */}
                <div className="space-y-6 pb-20">
                    <div>
                        <h2 className="text-xl font-medium tracking-tight flex items-center gap-2">
                            The Mirror <span className="text-zinc-500 text-sm font-normal">(Persona Analysis)</span>
                        </h2>
                        <p className="text-zinc-500 text-sm mt-2 leading-relaxed">
                            Analyze your approved tweets to see what public persona you are actively projecting. 
                            Requires at least 3 approved tweets.
                        </p>
                    </div>

                    <button
                        onClick={handleAnalyze}
                        disabled={mirrorLoading}
                        className={`group relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed overflow-hidden border ${
                            mirrorLoading
                                ? 'bg-violet-500/[0.08] border-violet-500/15 text-zinc-400'
                                : 'bg-gradient-to-br from-violet-500/15 to-blue-500/15 border-violet-500/30 text-violet-300 hover:from-violet-500/25 hover:to-blue-500/25'
                        }`}
                    >
                        <Sparkles className={`w-4 h-4 ${mirrorLoading ? 'hidden' : ''}`} />
                        <Loader2 className={`w-4 h-4 animate-spin ${mirrorLoading ? '' : 'hidden'}`} />
                        {mirrorLoading ? 'Analyzing...' : 'Analyze My Public Persona'}
                    </button>

                    {mirrorError && (
                        <div className="bg-red-950/30 text-red-500 p-4 rounded-md border border-red-900/50 text-sm">
                            {mirrorError}
                        </div>
                    )}

                    {mirrorAnalysis && (
                        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-500 opacity-50"></div>
                            <div className="prose prose-invert prose-zinc max-w-none text-[15px] leading-relaxed whitespace-pre-wrap">
                                {mirrorAnalysis}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
