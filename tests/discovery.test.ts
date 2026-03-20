import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeLiveTopics, parseGoogleNewsFeed, parseXTrendPayload } from '../utils/discovery.ts';

test('parseGoogleNewsFeed extracts readable topic cards from RSS', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0">
    <channel>
      <item>
        <title>Chip export rules tighten again - Example Source</title>
        <link>https://example.com/story</link>
        <description><![CDATA[<p>A policy story about semiconductors.</p>]]></description>
        <pubDate>Fri, 20 Mar 2026 10:00:00 GMT</pubDate>
        <source url="https://example.com">Example Source</source>
      </item>
    </channel>
  </rss>`;

  const topics = parseGoogleNewsFeed(xml, 'Fallback Feed');

  assert.equal(topics.length, 1);
  assert.equal(topics[0]?.title, 'Chip export rules tighten again');
  assert.match(topics[0]?.summary || '', /policy story about semiconductors/i);
});

test('parseXTrendPayload converts trend API payload into usable live topics', () => {
  const topics = parseXTrendPayload([
    {
      locations: [{ name: 'Worldwide' }],
      trends: [{ name: 'OpenAI', url: 'https://x.com/search?q=OpenAI', tweet_volume: 120000 }],
    },
  ]);

  assert.equal(topics.length, 1);
  assert.equal(topics[0]?.kind, 'x_trend');
  assert.equal(topics[0]?.sourceLabel, 'Worldwide');
  assert.match(topics[0]?.summary || '', /posts in the last 24h/i);
});

test('dedupeLiveTopics removes duplicate titles within the same source kind', () => {
  const deduped = dedupeLiveTopics([
    {
      id: 'one',
      kind: 'news',
      title: 'Same title',
      summary: 'A',
      sourceUrl: null,
      sourceLabel: 'Feed',
      freshnessLabel: null,
      promptHint: 'Prompt',
      topicUrl: null,
    },
    {
      id: 'two',
      kind: 'news',
      title: 'Same title',
      summary: 'B',
      sourceUrl: null,
      sourceLabel: 'Feed',
      freshnessLabel: null,
      promptHint: 'Prompt',
      topicUrl: null,
    },
  ]);

  assert.equal(deduped.length, 1);
});
