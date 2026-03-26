import test from 'node:test';
import assert from 'node:assert/strict';
import {
  choosePostPlan,
  getDaypartBucket,
  recommendTopicArchetype,
} from '../utils/post-strategy.ts';

test('getDaypartBucket maps morning afternoon and evening', () => {
  assert.equal(getDaypartBucket(new Date('2026-03-26T05:00:00+05:30')), 'morning');
  assert.equal(getDaypartBucket(new Date('2026-03-26T14:00:00+05:30')), 'afternoon');
  assert.equal(getDaypartBucket(new Date('2026-03-26T20:00:00+05:30')), 'evening');
});

test('choosePostPlan avoids repeating the last archetype', () => {
  const plan = choosePostPlan({
    mode: 'general',
    hasLiveTopic: false,
    now: new Date('2026-03-26T09:00:00.000Z'),
    recentPosts: [
      { post_archetype: 'question', surface_intent: 'conversation_starter' },
      { post_archetype: 'hard_statement', surface_intent: 'feed_post' },
    ],
  });

  assert.notEqual(plan.archetype, 'question');
});

test('recommendTopicArchetype favors trend reaction for startup and technology topics', () => {
  const recommendation = recommendTopicArchetype({
    kind: 'news',
    topic: 'startups',
    title: 'New product launch changes founder workflows',
  });

  assert.equal(recommendation.recommendedArchetype, 'trend_reaction');
  assert.ok(recommendation.buildRelevanceScore >= 0.8);
});
