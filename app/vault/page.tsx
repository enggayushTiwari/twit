'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRawIdeas, deleteRawIdea } from '../actions';
import { Loader2, Trash2, Database, ExternalLink } from 'lucide-react';

type RawIdea = {
    id: string;
    content: string;
    type: string;
    created_at: string;
    metadata?: {
        source_url?: string;
        title?: string;
    } | null;
};

export default function VaultPage() {
    const [ideas, setIdeas] = useState<RawIdea[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getDomain = (url?: string) => {
        if (!url) return '';
        try {
            const domain = new URL(url).hostname;
            return domain.replace('www.', '');
        } catch {
            return url;
        }
    };

    useEffect(() => {
        async function fetchIdeas() {
            setLoading(true);
            const result = await getRawIdeas();
            if (result.success && result.data) {
                setIdeas(result.data);
            } else {
                setError(result.error || 'Failed to load vault data.');
            }
            setLoading(false);
        }
        fetchIdeas();
    }, []);

    const handleDelete = async (id: string) => {
        // Optimistic delete
        setIdeas(current => current.filter(idea => idea.id !== id));
        
        const result = await deleteRawIdea(id);
        if (!result.success) {
            // Revert on failure (could be improved, but this is fine for MVP)
            alert(`Failed to delete: ${result.error}`);
            // Re-fetch to guarantee accuracy
            const refresh = await getRawIdeas();
            if (refresh.success && refresh.data) {
                setIdeas(refresh.data);
            }
        }
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
            <header className="max-w-4xl mx-auto w-full border-b border-zinc-900 pb-8 mb-8">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/20 flex items-center justify-center">
                            <Database className="w-4 h-4 text-indigo-400" />
                        </div>
                        <h1 className="text-2xl font-medium tracking-tight">Knowledge Vault</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link href="/profile" className="text-zinc-500 hover:text-zinc-300 text-sm font-medium transition-colors">
                            Define Persona
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
                    All your raw inputs, project dumps, and ideas in one place.
                </p>
            </header>

            <main className="max-w-4xl mx-auto w-full">
                {error && (
                    <div className="bg-red-950/30 text-red-500 p-4 rounded-md border border-red-900/50 text-sm mb-6">
                        {error}
                    </div>
                )}

                {ideas.length === 0 && !error ? (
                    <div className="text-center py-20 bg-zinc-950/50 border border-zinc-900/50 rounded-2xl">
                        <p className="text-zinc-500">Your vault is empty. Go drop some ideas!</p>
                        <Link href="/" className="inline-block mt-4 text-sm bg-zinc-100 text-[#050505] px-4 py-2 rounded-full font-medium transition-transform hover:scale-105">
                            Start Capturing
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {ideas.map((idea) => (
                            <div 
                                key={idea.id} 
                                className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex flex-col group relative overflow-hidden transition-all hover:border-zinc-800"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border flex items-center gap-1.5 ${
                                        idea.type === 'project_log' 
                                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                                            : idea.type === 'url'
                                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                    }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${
                                            idea.type === 'project_log' 
                                                ? 'bg-amber-500' 
                                                : idea.type === 'url'
                                                    ? 'bg-indigo-400'
                                                    : 'bg-blue-500'
                                        }`} />
                                        {idea.type === 'project_log' ? 'Project Log' : idea.type === 'url' ? 'Web Source' : 'Idea'}
                                    </span>
                                    
                                    <button
                                        onClick={() => handleDelete(idea.id)}
                                        className="text-zinc-700 hover:text-red-400 bg-zinc-900/50 hover:bg-red-500/10 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        title="Delete Item"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                {idea.type === 'url' && idea.metadata?.title && (
                                    <h4 className="text-sm font-medium text-zinc-400 mb-2 line-clamp-1">
                                        {idea.metadata.title}
                                    </h4>
                                )}
                                
                                <p className="text-[15px] leading-relaxed text-zinc-300 flex-1 whitespace-pre-wrap line-clamp-[8]">
                                    {idea.content}
                                </p>

                                <div className="mt-6 pt-4 border-t border-zinc-900/50 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs font-mono text-zinc-600">
                                            {new Date(idea.created_at).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                        
                                        {idea.type === 'url' && idea.metadata?.source_url && (
                                            <a 
                                                href={idea.metadata.source_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 text-[11px] font-medium text-indigo-400/70 hover:text-indigo-300 transition-colors"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                {getDomain(idea.metadata.source_url)}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
