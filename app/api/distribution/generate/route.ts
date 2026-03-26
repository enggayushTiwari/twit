import { NextRequest, NextResponse } from 'next/server';
import {
  generateBuildTweetDraft,
  generateCommunityOriginalDraft,
  generateConversationDraft,
} from '@/utils/generation-runner';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const draftKind = body?.draftKind as 'original_post' | 'reply' | 'quote_post' | undefined;
    const conversationOpportunityId = body?.conversationOpportunityId as string | undefined;
    const communityProfileId = body?.communityProfileId as string | undefined;

    if (draftKind === 'reply' || draftKind === 'quote_post') {
      if (!conversationOpportunityId) {
        return NextResponse.json(
          { success: false, error: 'conversationOpportunityId is required for replies and quote posts.' },
          { status: 400 }
        );
      }

      const result = await generateConversationDraft({
        draftKind,
        conversationOpportunityId,
      });

      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    if (draftKind === 'original_post' && communityProfileId) {
      const result = await generateCommunityOriginalDraft({ communityProfileId });
      return NextResponse.json(result, { status: result.success ? 200 : 400 });
    }

    const result = await generateBuildTweetDraft();
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate distribution draft.',
      },
      { status: 500 }
    );
  }
}
