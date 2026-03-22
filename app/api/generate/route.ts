import { NextResponse } from 'next/server';
import { generateGeneralTweetDraft } from '@/utils/generation-runner';

export const dynamic = 'force-dynamic';

export async function POST() {
  const result = await generateGeneralTweetDraft();

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    tweet: result.tweet,
  });
}
