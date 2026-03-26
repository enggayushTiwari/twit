import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNewsFeedUrl,
  dedupeLiveTopics,
  parseGoogleNewsFeed,
  parseXTrendPayload,
} from '../utils/discovery.ts';

test('buildNewsFeedUrl respects country and topic locale config', () => {
  const url = buildNewsFeedUrl('in', 'technology');

  assert.match(url, /TECHNOLOGY/);
  assert.match(url, /gl=IN/);
  assert.match(url, /ceid=IN%3Aen/);
});

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

  const topics = parseGoogleNewsFeed(xml, {
    country: 'worldwide',
    topic: 'policy',
    fallbackSourceLabel: 'Fallback Feed',
  });

  assert.equal(topics.length, 1);
  assert.equal(topics[0]?.title, 'Chip export rules tighten again');
  assert.match(topics[0]?.summary || '', /policy story about semiconductors/i);
  assert.equal(topics[0]?.country, 'worldwide');
  assert.equal(topics[0]?.topic, 'policy');
});

test('parseXTrendPayload converts trend API payload into usable live topics', () => {
  const topics = parseXTrendPayload(
    [
      {
        locations: [{ name: 'Worldwide' }],
        trends: [{ name: 'OpenAI', url: 'https://x.com/search?q=OpenAI', tweet_volume: 120000 }],
      },
    ],
    { country: 'worldwide', topic: 'ai' }
  );

  assert.equal(topics.length, 1);
  assert.equal(topics[0]?.kind, 'x_trend');
  assert.equal(topics[0]?.sourceLabel, 'Worldwide');
  assert.equal(topics[0]?.country, 'worldwide');
  assert.equal(topics[0]?.topic, 'ai');
  assert.match(topics[0]?.summary || '', /posts in the last 24h/i);
});

test('dedupeLiveTopics removes duplicate titles within the same source kind, country, and topic', () => {
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
      country: 'worldwide',
      topic: 'general',
      sourceType: 'news',
      recommendedArchetype: 'hard_statement',
      worldviewFitScore: 0.6,
      buildRelevanceScore: 0.4,
      postabilityScore: 0.7,
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
      country: 'worldwide',
      topic: 'general',
      sourceType: 'news',
      recommendedArchetype: 'hard_statement',
      worldviewFitScore: 0.6,
      buildRelevanceScore: 0.4,
      postabilityScore: 0.7,
    },
  ]);

  assert.equal(deduped.length, 1);
});
