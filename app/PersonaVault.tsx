'use client';

import { useState, useTransition } from 'react';
import { analyzeAndSavePersona } from './actions';
import { Users, Plus, Trash2, Sparkles, Loader2, CheckCircle2, AlertCircle, MessageSquareQuote } from 'lucide-react';

export default function PersonaVault() {
    const [handle, setHandle] = useState('');
    const [tweets, setTweets] = useState(['', '', '']);
    const [isPending, startTransition] = useTransition();
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');
    const [generatedProfile, setGeneratedProfile] = useState<string | null>(null);

    const handleAddTweet = () => {
        if (tweets.length < 5) {
            setTweets([...tweets, '']);
        }
    };

    const handleRemoveTweet = (index: number) => {
        if (tweets.length > 3) {
            const newTweets = tweets.filter((_, i) => i !== index);
            setTweets(newTweets);
        }
    };

    const handleTweetChange = (index: number, value: string) => {
        const newTweets = [...tweets];
        newTweets[index] = value;
        setTweets(newTweets);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!handle.trim() || tweets.some(t => !t.trim())) {
            setStatus('error');
            setMessage('Please fill in the handle and all 3-5 tweets.');
            return;
        }

        setStatus('idle');
        setMessage('');
        setGeneratedProfile(null);

        startTransition(async () => {
            const result = await analyzeAndSavePersona(handle, tweets);
            
            if (result.success) {
                setStatus('success');
                setMessage(`Persona DNA extracted for @${handle}`);
                setGeneratedProfile(result.data || null);
                // Reset form
                setHandle('');
                setTweets(['', '', '']);
            } else {
                setStatus('error');
                setMessage(result.error || 'Failed to extract persona.');
            }
        });
    };

    return (
        <div className="w-full bg-zinc-900/20 border border-zinc-900 rounded-3xl p-8 transition-all hover:border-zinc-800/80">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-500/10 rounded-lg">
                    <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-zinc-100">Train New Voice</h3>
                    <p className="text-sm text-zinc-500">Reverse-engineer a creator&apos;s persona from golden examples. The most recently saved voice becomes an optional reference during draft generation.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-zinc-600 ml-1">Creator Handle</label>
                    <input
                        type="text"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="@naval, @balajis, etc."
                        disabled={isPending}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl px-5 py-4 text-zinc-200 outline-none focus:border-indigo-500/50 transition-all disabled:opacity-50 placeholder:text-zinc-800"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-600">Golden Tweets (3-5)</label>
                        <span className="text-[10px] text-zinc-700 font-mono">{tweets.length}/5</span>
                    </div>
                    
                    {tweets.map((tweet, index) => (
                        <div key={index} className="group relative">
                            <textarea
                                value={tweet}
                                onChange={(e) => handleTweetChange(index, e.target.value)}
                                placeholder={`Golden Tweet #${index + 1}...`}
                                disabled={isPending}
                                className="w-full bg-zinc-950/50 border border-zinc-900 rounded-2xl px-5 py-4 text-sm text-zinc-300 outline-none focus:border-indigo-500/30 transition-all disabled:opacity-50 placeholder:text-zinc-800 min-h-[100px] resize-none"
                            />
                            {tweets.length > 3 && !isPending && (
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTweet(index)}
                                    className="absolute -right-2 -top-2 p-1.5 bg-zinc-900 border border-zinc-800 text-zinc-500 rounded-full opacity-0 group-hover:opacity-100 hover:text-red-400 hover:border-red-500/20 transition-all"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    ))}

                    {tweets.length < 5 && !isPending && (
                        <button
                            type="button"
                            onClick={handleAddTweet}
                            className="w-full py-3 border-2 border-dashed border-zinc-900 rounded-2xl text-zinc-600 hover:text-zinc-400 hover:border-zinc-800 transition-all flex items-center justify-center gap-2 text-sm font-medium"
                        >
                            <Plus className="w-4 h-4" />
                            Add another golden example
                        </button>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={isPending || !handle.trim() || tweets.some(t => !t.trim())}
                    className="w-full relative group overflow-hidden bg-zinc-100 text-[#050505] py-4 rounded-2xl font-bold text-sm transition-all hover:bg-white active:scale-[0.98] disabled:opacity-20 disabled:pointer-events-none"
                >
                    <div className="flex items-center justify-center gap-2 relative z-10">
                        {isPending ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Extracting Persona DNA...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                <span>Analyze & Save Voice</span>
                            </>
                        )}
                    </div>
                    {isPending && (
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-indigo-500/10 animate-pulse" />
                    )}
                </button>
            </form>

            {(status !== 'idle' || generatedProfile) && (
                <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
                    {status !== 'idle' && (
                        <div className={`flex items-start gap-3 p-4 rounded-2xl border ${
                            status === 'success' 
                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                                : 'bg-red-500/5 border-red-500/20 text-red-400'
                        }`}>
                            {status === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                            <span className="text-sm font-medium leading-relaxed">{message}</span>
                        </div>
                    )}

                    {generatedProfile && (
                        <div className="bg-zinc-950 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <MessageSquareQuote className="w-24 h-24 text-indigo-500" />
                            </div>
                            <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 mb-4 flex items-center gap-2">
                                <Sparkles className="w-3 h-3" />
                                Extracted Voice Framework
                            </h4>
                            <div className="prose prose-invert prose-sm max-w-none">
                                <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                                    {generatedProfile}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
