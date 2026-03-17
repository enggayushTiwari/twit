'use client';

import { useState, useTransition } from 'react';
import { saveUrlAsIdea } from './actions';
import { Link2, Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function UrlIngester() {
    const [url, setUrl] = useState('');
    const [isPending, startTransition] = useTransition();
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleFetch = async () => {
        if (!url.trim()) return;

        setStatus('idle');
        setMessage('');

        startTransition(async () => {
            const result = await saveUrlAsIdea(url);
            
            if (result.success) {
                setStatus('success');
                setMessage(`Successfully ingested: ${result.title}`);
                setUrl('');
                // Clear success message after 5 seconds
                setTimeout(() => {
                    setStatus('idle');
                    setMessage('');
                }, 5000);
            } else {
                setStatus('error');
                setMessage(result.error || 'Failed to ingest URL.');
            }
        });
    };

    return (
        <div className="w-full bg-zinc-900/20 border border-zinc-900 rounded-2xl p-6 transition-all hover:border-zinc-800">
            <div className="flex items-center gap-2 mb-4">
                <Link2 className="w-4 h-4 text-zinc-500" />
                <h3 className="text-sm font-medium text-zinc-400">Expand Knowledge Vault via URL</h3>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://nextjs.org/blog/next-15..."
                        disabled={isPending}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50 placeholder:text-zinc-700"
                    />
                    {isPending && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
                        </div>
                    )}
                </div>
                
                <button
                    onClick={handleFetch}
                    disabled={!url.trim() || isPending}
                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-30 disabled:pointer-events-none whitespace-nowrap ${
                        isPending
                            ? 'bg-zinc-800 text-zinc-500'
                            : 'bg-zinc-100 text-[#050505] hover:bg-white hover:scale-[1.02] active:scale-95'
                    }`}
                >
                    {isPending ? (
                        <>
                            <Sparkles className="w-4 h-4 animate-pulse text-indigo-500" />
                            Scraping & Embedding...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            Fetch & Save
                        </>
                    )}
                </button>
            </div>

            {status !== 'idle' && (
                <div className={`mt-4 flex items-start gap-2 text-xs font-medium px-4 py-3 rounded-lg border animate-in fade-in slide-in-from-top-1 ${
                    status === 'success' 
                        ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                        : 'bg-red-500/5 border-red-500/20 text-red-400'
                }`}>
                    {status === 'success' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span className="leading-relaxed">{message}</span>
                </div>
            )}
        </div>
    );
}
