import { NextResponse } from 'next/server';
import { generateStartupTweetDraft } from '@/utils/generation-runner';

export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await generateStartupTweetDraft();

  if (!result.success) {
    const status = /save some startup memory/i.test(result.error) ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    success: true,
    tweet: result.tweet,
  });
}
