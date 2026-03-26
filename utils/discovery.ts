import * as cheerio from 'cheerio';
import type { DiscoveryCountryId, DiscoveryTopicId } from './discovery-config';
import { recommendTopicArchetype } from './post-strategy.js';
import type { PostArchetype } from './self-model';

const DISCOVERY_COUNTRY_RUNTIME = {
  worldwide: {
    id: 'worldwide',
    label: 'Worldwide',
    news: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  },
  us: {
    id: 'us',
    label: 'United States',
    news: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  },
  in: {
    id: 'in',
    label: 'India',
    news: { hl: 'en-IN', gl: 'IN', ceid: 'IN:en' },
  },
  gb: {
    id: 'gb',
    label: 'United Kingdom',
    news: { hl: 'en-GB', gl: 'GB', ceid: 'GB:en' },
  },
  jp: {
    id: 'jp',
    label: 'Japan',
    news: { hl: 'en', gl: 'JP', ceid: 'JP:en' },
  },
} as const satisfies Record<
  DiscoveryCountryId,
  {
    id: DiscoveryCountryId;
    label: string;
    news: { hl: string; gl: string; ceid: string };
  }
>;

const DISCOVERY_TOPIC_RUNTIME = {
  general: { id: 'general', label: 'General', mode: 'top', query: '' },
  technology: { id: 'technology', label: 'Technology', mode: 'section', query: 'TECHNOLOGY' },
  business: { id: 'business', label: 'Business', mode: 'section', query: 'BUSINESS' },
  ai: {
    id: 'ai',
    label: 'AI',
    mode: 'search',
    query: 'artificial intelligence OR generative AI OR OpenAI OR Gemini',
  },
  startups: {
    id: 'startups',
    label: 'Startups',
    mode: 'search',
    query: 'startup OR startups OR founders OR venture capital',
  },
  finance: {
    id: 'finance',
    label: 'Finance',
    mode: 'search',
    query: 'finance OR markets OR economy OR investing',
  },
  policy: {
    id: 'policy',
    label: 'Policy',
    mode: 'search',
    query: 'policy OR regulation OR law OR government',
  },
} as const satisfies Record<
  DiscoveryTopicId,
  {
    id: DiscoveryTopicId;
    label: string;
    mode: 'top' | 'section' | 'search';
    query: string;
  }
>;

function getRuntimeCountry(countryId: DiscoveryCountryId) {
  return DISCOVERY_COUNTRY_RUNTIME[countryId] || DISCOVERY_COUNTRY_RUNTIME.worldwide;
}

function getRuntimeTopic(topicId: DiscoveryTopicId) {
  return DISCOVERY_TOPIC_RUNTIME[topicId] || DISCOVERY_TOPIC_RUNTIME.general;
}

export type LiveTopic = {
  id: string;
  kind: 'news' | 'x_trend';
  title: string;
  summary: string;
  sourceUrl: string | null;
  sourceLabel: string;
  freshnessLabel: string | null;
  promptHint: string;
  topicUrl: string | null;
  country: DiscoveryCountryId;
  topic: DiscoveryTopicId;
  sourceType: 'news' | 'x';
  recommendedArchetype: PostArchetype;
  worldviewFitScore: number;
  buildRelevanceScore: number;
  postabilityScore: number;
};

function sanitizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string) {
  const $ = cheerio.load(value);
  return sanitizeText($.text());
}

function createTopicId(prefix: string, title: string) {
  const normalized = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return `${prefix}-${normalized || 'topic'}`;
}

export function buildNewsFeedUrl(countryId: DiscoveryCountryId, topicId: DiscoveryTopicId) {
  const country = getRuntimeCountry(countryId);
  const topic = getRuntimeTopic(topicId);
  const { hl, gl, ceid } = country.news;

  if (topic.mode === 'top') {
    return `https://news.google.com/rss?hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
  }

  if (topic.mode === 'section') {
    return `https://news.google.com/rss/headlines/section/topic/${encodeURIComponent(topic.query)}?hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
  }

  return `https://news.google.com/rss/search?q=${encodeURIComponent(topic.query)}&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}&ceid=${encodeURIComponent(ceid)}`;
}

export function parseGoogleNewsFeed(
  xml: string,
  params: { country: DiscoveryCountryId; topic: DiscoveryTopicId; fallbackSourceLabel: string }
): LiveTopic[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const topics: LiveTopic[] = [];

  $('item').each((index, element) => {
    const rawTitle = sanitizeText($(element).find('title').first().text());
    const title = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
    const link = sanitizeText($(element).find('link').first().text()) || null;
    const sourceLabel =
      sanitizeText($(element).find('source').first().text()) || params.fallbackSourceLabel;
    const descriptionHtml = $(element).find('description').first().text();
    const description = stripHtml(descriptionHtml);
    const pubDate = sanitizeText($(element).find('pubDate').first().text()) || null;

    if (!title) {
      return;
    }

    topics.push({
      ...recommendTopicArchetype({ kind: 'news', topic: params.topic, title }),
      id: createTopicId(`news-${params.country}-${params.topic}-${index}`, title),
      kind: 'news',
      title,
      summary:
        description ||
        'Top story from the web. Use it as a prompt to articulate what you actually think.',
      sourceUrl: link,
      sourceLabel,
      freshnessLabel: pubDate,
      promptHint:
        'What is your actual take here? Is the deeper story about incentives, power, timing, systems, or culture?',
      topicUrl: link,
      country: params.country,
      topic: params.topic,
      sourceType: 'news',
    });
  });

  return topics;
}

type XTrendApiTrend = {
  name?: string;
  url?: string;
  tweet_volume?: number | null;
};

type XTrendApiPayload = Array<{
  trends?: XTrendApiTrend[];
  locations?: Array<{ name?: string }>;
}>;

export function parseXTrendPayload(
  payload: unknown,
  params: { country: DiscoveryCountryId; topic: DiscoveryTopicId }
): LiveTopic[] {
  const response = Array.isArray(payload) ? (payload as XTrendApiPayload) : [];
  const trendBlock = response[0];
  const locationName = trendBlock?.locations?.[0]?.name || 'X';
  const trends = Array.isArray(trendBlock?.trends) ? trendBlock.trends : [];

  return trends
    .filter((trend) => typeof trend?.name === 'string' && trend.name.trim())
    .slice(0, 8)
    .map((trend, index) => {
      const title = sanitizeText(trend.name || '');
      const tweetVolume =
        typeof trend.tweet_volume === 'number'
          ? `${trend.tweet_volume.toLocaleString()} posts in the last 24h`
          : 'Trending now on X';

      return {
        ...recommendTopicArchetype({ kind: 'x_trend', topic: params.topic, title }),
        id: createTopicId(`x-${params.country}-${params.topic}-${index}`, title),
        kind: 'x_trend',
        title,
        summary: `${tweetVolume}. Use the trend as a live signal, then articulate what you believe it reveals.`,
        sourceUrl: trend.url || null,
        sourceLabel: locationName,
        freshnessLabel: 'Live trend',
        promptHint:
          'Why is this trending, really? What does it reveal about attention, incentives, status, or timing?',
        topicUrl:
          trend.url ||
          `https://x.com/search?q=${encodeURIComponent(title)}&src=trend_click&f=live`,
        country: params.country,
        topic: params.topic,
        sourceType: 'x',
      };
    });
}

export function dedupeLiveTopics(topics: LiveTopic[]) {
  const seen = new Set<string>();
  return topics.filter((topic) => {
    const key = `${topic.kind}:${topic.country}:${topic.topic}:${topic.title.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
