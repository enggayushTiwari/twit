'use client';

import { useEffect } from 'react';
import { AUTO_GENERATION_HEARTBEAT_MINUTES } from '@/utils/auto-generation';

async function triggerAutoGeneration() {
  try {
    const response = await fetch('/api/autogen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      keepalive: true,
    });

    const data = await response.json().catch(() => null);
    const generatedCount = Array.isArray(data?.results)
      ? data.results.filter((item: { status?: string }) => item.status === 'generated').length
      : 0;

    if (generatedCount > 0) {
      window.dispatchEvent(new CustomEvent('autogen:completed'));
    }
  } catch {
    // Silent on purpose: this is a background heartbeat.
  }
}

export default function AutoGenerationHeartbeat() {
  useEffect(() => {
    void triggerAutoGeneration();

    const intervalId = window.setInterval(
      () => void triggerAutoGeneration(),
      AUTO_GENERATION_HEARTBEAT_MINUTES * 60 * 1000
    );

    return () => window.clearInterval(intervalId);
  }, []);

  return null;
}
