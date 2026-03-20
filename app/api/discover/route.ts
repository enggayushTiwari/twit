import { NextResponse } from 'next/server';
import { getErrorMessage } from '@/utils/errors';
import { dedupeLiveTopics, parseGoogleNewsFeed, parseXTrendPayload } from '@/utils/discovery';

export const dynamic = 'force-dynamic';

const GOOGLE_NEWS_FEEDS = [
  {
    label: 'Top Headlines',
    url: 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en',
  },
  {
    label: 'Technology',
    url: 'https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en',
  },
  {
    label: 'Business',
    url: 'https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en',
  },
];

async function fetchNewsTopics() {
  const settled = await Promise.allSettled(
    GOOGLE_NEWS_FEEDS.map(async (feed) => {
      const response = await fetch(feed.url, {
        next: { revalidate: 900 },
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      if (!response.ok) {
        throw new Error(`Feed ${feed.label} returned ${response.status}`);
      }

      const xml = await response.text();
      return parseGoogleNewsFeed(xml, feed.label);
    })
  );

  const topics = settled
    .filter((result): result is PromiseFulfilledResult<ReturnType<typeof parseGoogleNewsFeed>> => result.status === 'fulfilled')
    .flatMap((result) => result.value);

  return dedupeLiveTopics(topics).slice(0, 8);
}

async function fetchXTrendTopics() {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    return {
      topics: [],
      enabled: false,
      message: 'Set X_BEARER_TOKEN to surface live X trends here.',
    };
  }

  const woeid = process.env.X_TRENDS_WOEID || '1';
  const response = await fetch(`https://api.x.com/1.1/trends/place.json?id=${woeid}&exclude=hashtags`, {
    next: { revalidate: 900 },
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  if (!response.ok) {
    return {
      topics: [],
      enabled: false,
      message: `X trends request failed with ${response.status}.`,
    };
  }

  const payload = await response.json();
  return {
    topics: parseXTrendPayload(payload),
    enabled: true,
    message: null,
  };
}

export async function GET() {
  try {
    const [newsTopics, xTrends] = await Promise.all([fetchNewsTopics(), fetchXTrendTopics()]);

    return NextResponse.json({
      success: true,
      topics: [...xTrends.topics, ...newsTopics].slice(0, 12),
      meta: {
        xTrendsEnabled: xTrends.enabled,
        xTrendsMessage: xTrends.message,
        newsCount: newsTopics.length,
        xTrendCount: xTrends.topics.length,
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: getErrorMessage(error, 'Failed to discover live topics.'),
      },
      { status: 500 }
    );
  }
}
