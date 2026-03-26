import { NextResponse } from 'next/server';
import { generateBuildTweetDraft } from '@/utils/generation-runner';

export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await generateBuildTweetDraft();

  if (!result.success) {
    const status = /save some build memory/i.test(result.error) ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    success: true,
    tweet: result.tweet,
  });
}
