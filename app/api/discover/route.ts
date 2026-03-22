import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/utils/errors';
import {
  buildNewsFeedUrl,
  dedupeLiveTopics,
  parseGoogleNewsFeed,
  parseXTrendPayload,
} from '@/utils/discovery';
import {
  DISCOVERY_COUNTRIES,
  DISCOVERY_SOURCES,
  DISCOVERY_TOPICS,
  getDiscoveryCountry,
  getDiscoverySource,
  getDiscoveryTopic,
} from '@/utils/discovery-config';

export const dynamic = 'force-dynamic';

async function fetchNewsTopics(countryId: string, topicId: string) {
  const country = getDiscoveryCountry(countryId);
  const topic = getDiscoveryTopic(topicId);
  const feedUrl = buildNewsFeedUrl(country.id, topic.id);

  const response = await fetch(feedUrl, {
    next: { revalidate: 900 },
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Feed ${topic.label} returned ${response.status}`);
  }

  const xml = await response.text();
  return parseGoogleNewsFeed(xml, {
    country: country.id,
    topic: topic.id,
    fallbackSourceLabel: `${country.label} ${topic.label}`,
  });
}

async function fetchXTrendTopics(countryId: string, topicId: string) {
  const bearerToken = process.env.X_BEARER_TOKEN;
  if (!bearerToken) {
    return {
      topics: [],
      enabled: false,
      message: 'Set X_BEARER_TOKEN to surface live X trends here.',
    };
  }

  const country = getDiscoveryCountry(countryId);
  const response = await fetch(
    `https://api.x.com/1.1/trends/place.json?id=${country.xWoeid}&exclude=hashtags`,
    {
      next: { revalidate: 900 },
      headers: {
        Authorization: `Bearer ${bearerToken}`,
      },
    }
  );

  if (!response.ok) {
    return {
      topics: [],
      enabled: false,
      message: `X trends request failed with ${response.status}.`,
    };
  }

  const payload = await response.json();
  return {
    topics: parseXTrendPayload(payload, { country: country.id, topic: getDiscoveryTopic(topicId).id }),
    enabled: true,
    message: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const country = getDiscoveryCountry(searchParams.get('country') || undefined);
    const topic = getDiscoveryTopic(searchParams.get('topic') || undefined);
    const source = getDiscoverySource(searchParams.get('source') || undefined);

    const newsPromise =
      source === 'all' || source === 'news'
        ? fetchNewsTopics(country.id, topic.id)
        : Promise.resolve([]);
    const xPromise =
      source === 'all' || source === 'x'
        ? fetchXTrendTopics(country.id, topic.id)
        : Promise.resolve({
            topics: [],
            enabled: false,
            message: source === 'news' ? null : 'X trends are disabled for this view.',
          });

    const [newsTopics, xTrends] = await Promise.all([newsPromise, xPromise]);
    const topics = dedupeLiveTopics([...xTrends.topics, ...newsTopics]).slice(0, 18);

    return NextResponse.json({
      success: true,
      topics,
      meta: {
        selectedCountry: country.id,
        selectedTopic: topic.id,
        selectedSource: source,
        xTrendsEnabled: xTrends.enabled,
        xTrendsMessage: xTrends.message,
        newsCount: newsTopics.length,
        xTrendCount: xTrends.topics.length,
        fetchedAt: new Date().toISOString(),
        options: {
          countries: DISCOVERY_COUNTRIES,
          topics: DISCOVERY_TOPICS,
          sources: DISCOVERY_SOURCES,
        },
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
