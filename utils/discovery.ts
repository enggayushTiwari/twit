import * as cheerio from 'cheerio';

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

export function parseGoogleNewsFeed(xml: string, fallbackSourceLabel: string): LiveTopic[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const topics: LiveTopic[] = [];

  $('item').each((index, element) => {
    const rawTitle = sanitizeText($(element).find('title').first().text());
    const title = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim() || rawTitle;
    const link = sanitizeText($(element).find('link').first().text()) || null;
    const sourceLabel =
      sanitizeText($(element).find('source').first().text()) || fallbackSourceLabel;
    const descriptionHtml = $(element).find('description').first().text();
    const description = stripHtml(descriptionHtml);
    const pubDate = sanitizeText($(element).find('pubDate').first().text()) || null;

    if (!title) {
      return;
    }

    topics.push({
      id: createTopicId(`news-${index}`, title),
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

export function parseXTrendPayload(payload: unknown): LiveTopic[] {
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
        id: createTopicId(`x-${index}`, title),
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
      };
    });
}

export function dedupeLiveTopics(topics: LiveTopic[]) {
  const seen = new Set<string>();
  return topics.filter((topic) => {
    const key = `${topic.kind}:${topic.title.toLowerCase()}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
