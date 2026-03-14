'use client';

import { useState, useEffect } from 'react';
import { getPendingTweets, getTweetHistory, updateTweetStatus } from '../actions';
import Link from 'next/link';
import { Check, X, Loader2, Sparkles, Clock, CheckCircle2, XCircle } from 'lucide-react';

type Tweet = {
    id: string;
    content: string;
    status: string;
    created_at: string;
};

type Tab = 'pending' | 'history';

export default function ReviewDashboard() {
    const [activeTab, setActiveTab] = useState<Tab>('pending');
    const [tweets, setTweets] = useState<Tweet[]>([]);
    const [historyTweets, setHistoryTweets] = useState<Tweet[]>([]);
    const [loading, setLoading] = useState(true);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    async function loadTweets() {
        const result = await getPendingTweets();
        if (result.success && result.data) {
            setTweets(result.data);
        } else {
            setError(result.error);
        }
        setLoading(false);
    }

    async function loadHistory() {
        setHistoryLoading(true);
        const result = await getTweetHistory();
        if (result.success && result.data) {
            setHistoryTweets(result.data);
        } else {
            setError(result.error);
        }
        setHistoryLoading(false);
    }

    useEffect(() => {
        loadTweets();
    }, []);

    useEffect(() => {
        if (activeTab === 'history' && historyTweets.length === 0) {
            loadHistory();
        }
    }, [activeTab]);

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);

        try {
            const res = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Generation failed.');
            }

            await loadTweets();
        } catch (err: any) {
            alert(`Generation Error: ${err.message}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleUpdate = async (id: string, newContent: string, newStatus: string) => {
        setTweets((prev) => prev.filter((t) => t.id !== id));

        const result = await updateTweetStatus(id, newContent, newStatus);

        if (!result.success) {
            console.error('Failed to update tweet status:', result.error);
            alert(`Error: ${result.error}`);
        } else {
            // Refresh history if we're on it, so the new item appears
            if (activeTab === 'history') {
                loadHistory();
            }
        }
    };

    const handleTextChange = (id: string, newContent: string) => {
        setTweets((prev) =>
            prev.map((t) => (t.id === id ? { ...t, content: newContent } : t))
        );
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
                    <h1 className="text-2xl font-medium tracking-tight">Review Drafts</h1>
                    <div className="flex items-center gap-4">
                        <Link href="/vault" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            Knowledge Vault
                        </Link>
                        <Link href="/profile" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            Define Persona
                        </Link>
                        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            &larr; Back to Capture
                        </Link>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 mt-5 bg-zinc-900/50 rounded-lg p-1 w-fit">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'pending'
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Pending Queue
                        {tweets.length > 0 && (
                            <span className="ml-1 bg-violet-500/20 text-violet-300 text-xs px-2 py-0.5 rounded-full">
                                {tweets.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'history'
                            ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        History
                        {historyTweets.length > 0 && (
                            <span className="ml-1 bg-zinc-700/50 text-zinc-400 text-xs px-2 py-0.5 rounded-full">
                                {historyTweets.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Generate button — only show on pending tab */}
                {activeTab === 'pending' && (
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`mt-5 group relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed overflow-hidden border ${isGenerating
                            ? 'bg-violet-500/[0.08] border-violet-500/15 text-zinc-400'
                            : 'bg-gradient-to-br from-violet-500/15 to-blue-500/15 border-violet-500/30 text-violet-300 hover:from-violet-500/25 hover:to-blue-500/25'
                            }`}
                    >
                        <Sparkles className={`w-4 h-4 ${isGenerating ? 'hidden' : ''}`} />
                        <Loader2 className={`w-4 h-4 animate-spin ${isGenerating ? '' : 'hidden'}`} />
                        {isGenerating
                            ? 'Generating... (This takes a few seconds)'
                            : 'Generate New Draft'}
                    </button>
                )}
            </header>

            {error && (
                <div className="bg-red-950/30 text-red-500 p-4 rounded-md mb-8 max-w-3xl border border-red-900/50 text-sm">
                    {error}
                </div>
            )}

            {/* ====== PENDING QUEUE ====== */}
            {activeTab === 'pending' && (
                <div className="max-w-3xl space-y-6">
                    {tweets.length === 0 && !error && (
                        <div className="text-zinc-600 text-center py-20 border border-zinc-900 border-dashed rounded-xl">
                            No pending tweets at the moment. Click &quot;Generate New Draft&quot; above to create one!
                        </div>
                    )}

                    {tweets.map((tweet) => (
                        <div
                            key={tweet.id}
                            className="group bg-zinc-950 border border-zinc-900 rounded-2xl p-6 transition-all hover:border-zinc-800"
                        >
                            <textarea
                                className="w-full bg-transparent text-lg text-zinc-200 outline-none resize-none leading-relaxed min-h-[100px] mb-4"
                                value={tweet.content}
                                onChange={(e) => handleTextChange(tweet.id, e.target.value)}
                                spellCheck={false}
                            />

                            <div className="flex items-center justify-between">
                                <span className="text-xs font-mono text-zinc-600">
                                    {tweet.content.length}/280
                                </span>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleUpdate(tweet.id, tweet.content, 'REJECTED')}
                                        className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                        title="Reject"
                                    >
                                        <X className="w-4 h-4" /> Reject
                                    </button>
                                    <button
                                        onClick={() => handleUpdate(tweet.id, tweet.content, 'APPROVED')}
                                        className="flex items-center gap-2 px-6 py-2 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-medium hover:bg-emerald-500 hover:text-white transition-colors"
                                    >
                                        <Check className="w-4 h-4" /> Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ====== HISTORY ====== */}
            {activeTab === 'history' && (
                <div className="max-w-3xl space-y-4">
                    {historyLoading && (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
                        </div>
                    )}

                    {!historyLoading && historyTweets.length === 0 && !error && (
                        <div className="text-zinc-600 text-center py-20 border border-zinc-900 border-dashed rounded-xl">
                            No history yet. Approve or reject some tweets to see them here.
                        </div>
                    )}

                    {!historyLoading && historyTweets.map((tweet) => (
                        <div
                            key={tweet.id}
                            className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 transition-all hover:border-zinc-800"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <p className="text-[15px] text-zinc-300 leading-relaxed flex-1">
                                    {tweet.content}
                                </p>
                                <span
                                    className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${tweet.status === 'APPROVED'
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-red-500/10 text-red-400'
                                        }`}
                                >
                                    {tweet.status === 'APPROVED' ? (
                                        <CheckCircle2 className="w-3 h-3" />
                                    ) : (
                                        <XCircle className="w-3 h-3" />
                                    )}
                                    {tweet.status}
                                </span>
                            </div>
                            <div className="mt-3">
                                <span className="text-xs font-mono text-zinc-700">
                                    {new Date(tweet.created_at).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
