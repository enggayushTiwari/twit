import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { IMAGE_GENERATION_MODEL } from '@/utils/ai-config';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

function buildImagePrompt(params: {
  draft: string;
  mediaType: string;
  mediaReason?: string;
  assetBrief?: string;
  searchQuery?: string;
}) {
  return [
    `Create one high-quality supporting image for this X post.`,
    `Post: ${params.draft}`,
    `Requested media type: ${params.mediaType}`,
    params.mediaReason ? `Reason: ${params.mediaReason}` : '',
    params.assetBrief ? `Asset brief: ${params.assetBrief}` : '',
    params.searchQuery ? `Search/query hint: ${params.searchQuery}` : '',
    'Style: clean, modern, high-contrast, social-ready, readable at small sizes.',
    'Do not add watermarks, UI chrome, or visible text unless the brief strongly requires it.',
  ]
    .filter(Boolean)
    .join('\n');
}

function extractGeneratedImage(response: unknown) {
  const generatedImages =
    (response as {
      generatedImages?: Array<{ image?: { imageBytes?: string; mimeType?: string } }>;
    })?.generatedImages || [];
  const image = generatedImages.find((item) => item.image?.imageBytes)?.image;
  if (!image?.imageBytes) {
    return null;
  }

  return {
    data: image.imageBytes,
    mimeType: image.mimeType || 'image/png',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const draft = String(body?.draft || '').trim();
    const mediaType = String(body?.mediaType || '').trim();

    if (!draft || !mediaType) {
      return NextResponse.json(
        { success: false, error: 'draft and mediaType are required.' },
        { status: 400 }
      );
    }

    if (mediaType === 'gif' || mediaType === 'short_video') {
      return NextResponse.json(
        {
          success: false,
          error: 'GIF and video are suggestion-only right now. Generate an image instead or use the search query.',
        },
        { status: 400 }
      );
    }

    const response = await ai.models.generateImages({
      model: IMAGE_GENERATION_MODEL,
      prompt: buildImagePrompt({
        draft,
        mediaType,
        mediaReason: String(body?.mediaReason || ''),
        assetBrief: String(body?.assetBrief || ''),
        searchQuery: String(body?.searchQuery || ''),
      }),
      config: {
        numberOfImages: 1,
      },
    });

    const image = extractGeneratedImage(response);
    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Image model did not return an image.' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      imageDataUrl: `data:${image.mimeType};base64,${image.data}`,
      mimeType: image.mimeType,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to generate supporting media.',
      },
      { status: 500 }
    );
  }
}
