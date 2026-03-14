'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { saveIdeaWithEmbedding } from './actions';
import { Brain, Plus, Loader2, CheckCircle2 } from 'lucide-react';

export default function Home() {
  const [idea, setIdea] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'idea' | 'project_log'>('idea');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  const [thinkError, setThinkError] = useState<string | null>(null);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<number>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [idea]);

  const handleSave = async () => {
    if (!idea.trim()) return;

    setIsSaving(true);

    const result = await saveIdeaWithEmbedding(idea, activeTab);

    setIsSaving(false);

    if (!result.success) {
      alert(`Error saving idea: ${result.error}`);
    } else {
      setIdea(''); // Clear the input after successful save
    }
  };

  const handleBrainstorm = async () => {
    setThinking(true);
    setThinkError(null);
    setSuggestions([]);
    setAddedSuggestions(new Set());

    try {
      const response = await fetch('/api/brainstorm', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to brainstorm');
      }

      setSuggestions(data.suggestions);
    } catch (err: any) {
      setThinkError(err.message);
    } finally {
      setThinking(false);
    }
  };

  const handleAddSuggestion = async (text: string, index: number) => {
    // Optimistic add
    setAddedSuggestions(prev => new Set(prev).add(index));
    const result = await saveIdeaWithEmbedding(text, 'idea');
    if (!result.success) {
      alert(`Failed to save suggestion: ${result.error}`);
      setAddedSuggestions(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 flex flex-col items-center px-6 py-12 selection:bg-zinc-800">
      <div className="w-full max-w-2xl flex flex-col h-[80vh]">
        {/* Header */}
        <header className="mb-12">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-medium tracking-tight text-zinc-500">
              Idea Engine
            </h1>
          </div>

          {/* Capture Tabs */}
          <div className="flex items-center gap-1 mt-6 bg-zinc-900/50 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('idea')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'idea'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Drop an Idea
            </button>
            <button
              onClick={() => setActiveTab('project_log')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === 'project_log'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              Drop a Project Log
            </button>
          </div>
        </header>

        {/* Capture Area */}
        <main className="flex-1 flex flex-col justify-center">
          <textarea
            ref={textareaRef}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder={
              activeTab === 'idea'
                ? "Drop a raw thought on startups, systems, or distribution..."
                : "Paste a git commit summary, a bug you fixed, or raw architecture notes..."
            }
            className="w-full bg-transparent text-2xl sm:text-4xl leading-snug resize-none outline-none placeholder:text-zinc-800 transition-colors focus:placeholder:text-zinc-700 min-h-[150px] overflow-hidden"
            spellCheck={false}
            autoFocus
          />
        </main>

        {/* Footer Actions */}
        <footer className="mt-8 flex items-center justify-between border-t border-zinc-900 pt-6">
          <div className="flex items-center gap-6">
            <div className="text-sm font-mono text-zinc-600">
              {idea.length > 0 ? `${idea.length} chars` : 'Ready'}
            </div>
            <Link href="/vault" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-medium">
              Knowledge Vault
            </Link>
            <Link href="/profile" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-medium">
              Define Persona
            </Link>
            <Link href="/review" className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors font-medium">
              Review Drafts &rarr;
            </Link>
          </div>

          <button
            onClick={handleSave}
            disabled={idea.trim().length === 0 || isSaving}
            className="bg-zinc-100 text-[#050505] px-6 py-2.5 rounded-full font-medium text-sm transition-all hover:bg-white hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
          >
            {isSaving ? 'Saving...' : 'Save Idea'}
          </button>
        </footer>

        {/* Co-Thinker Section */}
        <section className="mt-20 pt-12 border-t border-zinc-900/50">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-lg font-medium flex items-center gap-2">
                Co-Thinker <span className="text-zinc-600 text-xs px-2 py-0.5 rounded-full border border-zinc-800">Alpha</span>
              </h2>
              <p className="text-sm text-zinc-500 mt-1">
                Extrapolate your vault into entirely new, unexplored territory.
              </p>
            </div>
            <button
              onClick={handleBrainstorm}
              disabled={thinking}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                thinking
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-500 cursor-wait'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 hover:border-indigo-500/30'
              }`}
            >
              {thinking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              {thinking ? 'Thinking...' : 'Brainstorm Adjacent Ideas'}
            </button>
          </div>

          {thinkError && (
            <div className="bg-red-950/30 text-red-500 p-4 rounded-md border border-red-900/50 text-sm mb-6">
              {thinkError}
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-20">
              {suggestions.map((suggestion, idx) => {
                const isAdded = addedSuggestions.has(idx);
                return (
                  <div 
                    key={idx}
                    className={`bg-zinc-950 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between transition-all duration-500 ${
                      isAdded ? 'opacity-50 grayscale' : 'hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                    }`}
                  >
                    <p className="text-sm text-zinc-300 leading-relaxed overflow-y-auto mb-4 custom-scrollbar pr-2 max-h-[120px]">
                      {suggestion}
                    </p>
                    <button
                      onClick={() => handleAddSuggestion(suggestion, idx)}
                      disabled={isAdded}
                      className={`flex items-center justify-center gap-2 w-full py-2 rounded-md text-xs font-semibold transition-all ${
                        isAdded
                          ? 'bg-green-500/10 text-green-500 cursor-default'
                          : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Added to Vault
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          Add to Vault
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
