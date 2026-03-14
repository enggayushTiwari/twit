'use client';

import { useState, useEffect } from 'react';
import { getAllIdeas } from '../actions';
import Link from 'next/link';
import { Loader2, Lightbulb } from 'lucide-react';

type Idea = {
    id: string;
    content: string;
    created_at: string;
};

export default function IdeasPage() {
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadIdeas() {
            const result = await getAllIdeas();
            if (result.success && result.data) {
                setIdeas(result.data);
            } else {
                setError(result.error);
            }
            setLoading(false);
        }
        loadIdeas();
    }, []);

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
                    <h1 className="text-2xl font-medium tracking-tight">Saved Ideas</h1>
                    <div className="flex items-center gap-4">
                        <Link href="/review" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            Review Drafts &rarr;
                        </Link>
                        <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            &larr; Capture
                        </Link>
                    </div>
                </div>
                <p className="text-zinc-500 mt-2">
                    {ideas.length} {ideas.length === 1 ? 'idea' : 'ideas'} captured so far.
                </p>
            </header>

            {error && (
                <div className="bg-red-950/30 text-red-500 p-4 rounded-md mb-8 max-w-3xl border border-red-900/50 text-sm">
                    {error}
                </div>
            )}

            <div className="max-w-3xl space-y-4">
                {ideas.length === 0 && !error && (
                    <div className="text-zinc-600 text-center py-20 border border-zinc-900 border-dashed rounded-xl">
                        No ideas yet. Go to the Capture page to add your first idea!
                    </div>
                )}

                {ideas.map((idea) => (
                    <div
                        key={idea.id}
                        className="group bg-zinc-950 border border-zinc-900 rounded-2xl p-5 transition-all hover:border-zinc-800"
                    >
                        <div className="flex items-start gap-3">
                            <Lightbulb className="w-4 h-4 text-amber-500/60 mt-1 shrink-0" />
                            <p className="text-zinc-300 leading-relaxed text-[15px]">
                                {idea.content}
                            </p>
                        </div>
                        <div className="mt-3 pl-7">
                            <span className="text-xs font-mono text-zinc-700">
                                {new Date(idea.created_at).toLocaleDateString('en-US', {
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
        </div>
    );
}
