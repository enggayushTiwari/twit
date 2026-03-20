'use client';

import { useEffect, useState } from 'react';
import { Loader2, ArrowRight, SkipForward } from 'lucide-react';
import type { ReflectionTurn } from '@/utils/self-model';
import { normalizeReflectionMetadata } from '@/utils/self-model';

type ReflectionPromptCardProps = {
  reflection: ReflectionTurn;
  title?: string;
  description?: string;
  submitLabel?: string;
  onSubmit: (answer: string) => Promise<void>;
  onSkip?: () => Promise<void>;
};

export default function ReflectionPromptCard({
  reflection,
  title = 'Reflection Prompt',
  description,
  submitLabel = 'Save Reflection',
  onSubmit,
  onSkip,
}: ReflectionPromptCardProps) {
  const metadata = normalizeReflectionMetadata(reflection.metadata);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setAnswer('');
    setLocalError(null);
  }, [reflection.id]);

  async function handleSubmit(nextAnswer: string) {
    if (!nextAnswer.trim()) {
      setLocalError('Add a quick answer first.');
      return;
    }

    try {
      setSubmitting(true);
      setLocalError(null);
      await onSubmit(nextAnswer.trim());
      setAnswer('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save reflection.';
      setLocalError(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSkip() {
    if (!onSkip) {
      return;
    }

    try {
      setSkipping(true);
      setLocalError(null);
      await onSkip();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to skip reflection.';
      setLocalError(message);
    } finally {
      setSkipping(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{title}</p>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">{description}</p>
          ) : null}
        </div>
        {metadata.stage ? (
          <span className="rounded-full border border-zinc-800 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
            {metadata.stage}
          </span>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/70 p-4">
        <p className="text-sm leading-relaxed text-zinc-200">{reflection.prompt}</p>
        {metadata.rationale ? (
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">{metadata.rationale}</p>
        ) : null}
      </div>

      {metadata.format === 'pairwise' && metadata.options && metadata.options.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {metadata.options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={submitting || skipping}
              onClick={() => void handleSubmit(option)}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-left text-sm leading-relaxed text-zinc-300 transition-colors hover:border-amber-500/40 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {option}
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-4">
          <textarea
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Answer in your own words. A few sharp sentences is enough."
            className="min-h-[112px] w-full resize-none rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-200 outline-none transition-colors placeholder:text-zinc-700 focus:border-zinc-600"
            spellCheck={false}
          />
        </div>
      )}

      {localError ? (
        <div className="mt-4 rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {localError}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {metadata.format !== 'pairwise' ? (
          <button
            type="button"
            onClick={() => void handleSubmit(answer)}
            disabled={submitting || skipping}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {submitting ? 'Saving...' : submitLabel}
          </button>
        ) : null}

        {onSkip ? (
          <button
            type="button"
            onClick={() => void handleSkip()}
            disabled={submitting || skipping}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {skipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
            {skipping ? 'Skipping...' : 'Skip for now'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
