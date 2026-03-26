import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateBuildTweetDraft, generateGeneralTweetDraft } from '@/utils/generation-runner';
import { AUTO_GENERATION_INTERVAL_MINUTES, isAutoGenerationDue } from '@/utils/auto-generation';

export const dynamic = 'force-dynamic';

type GeneratedTweetTimestampRow = {
  created_at: string;
};

function createSupabaseClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'placeholder';

  return createClient(supabaseUrl, supabaseKey);
}

export async function POST() {
  const supabase = createSupabaseClient();
  const now = new Date();

  const [latestGeneralRow, latestBuildRow] = await Promise.all([
    supabase
      .from('generated_tweets')
      .select('created_at')
      .eq('generation_mode', 'general')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('generated_tweets')
      .select('created_at')
      .in('generation_mode', ['build', 'startup'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const results: Array<{
    mode: 'general' | 'build';
    status: 'generated' | 'skipped';
    reason?: string;
    tweetId?: string;
  }> = [];

  if (isAutoGenerationDue((latestGeneralRow.data as GeneratedTweetTimestampRow | null)?.created_at, now)) {
    const result = await generateGeneralTweetDraft();
    results.push(
      result.success
        ? { mode: 'general', status: 'generated', tweetId: result.tweet.id }
        : { mode: 'general', status: 'skipped', reason: result.error }
    );
  } else {
    results.push({
      mode: 'general',
      status: 'skipped',
      reason: `Latest general draft is newer than ${AUTO_GENERATION_INTERVAL_MINUTES} minutes.`,
    });
  }

  if (isAutoGenerationDue((latestBuildRow.data as GeneratedTweetTimestampRow | null)?.created_at, now)) {
    const result = await generateBuildTweetDraft();
    results.push(
      result.success
        ? { mode: 'build', status: 'generated', tweetId: result.tweet.id }
        : { mode: 'build', status: 'skipped', reason: result.error }
    );
  } else {
    results.push({
      mode: 'build',
      status: 'skipped',
      reason: `Latest build draft is newer than ${AUTO_GENERATION_INTERVAL_MINUTES} minutes.`,
    });
  }

  return NextResponse.json({
    success: true,
    intervalMinutes: AUTO_GENERATION_INTERVAL_MINUTES,
    results,
  });
}
