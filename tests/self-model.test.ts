import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFeedbackSuggestion,
  calculateEditIntensity,
  shouldTriggerBroadReflection,
} from '../utils/self-model.ts';

test('shouldTriggerBroadReflection fires after enough new ideas', () => {
  assert.equal(
    shouldTriggerBroadReflection({
      newIdeaCount: 5,
      lastBroadReflectionAt: null,
      unresolvedOpenQuestionCount: 0,
    }),
    true
  );
});

test('shouldTriggerBroadReflection fires on stale unresolved themes', () => {
  assert.equal(
    shouldTriggerBroadReflection({
      newIdeaCount: 1,
      lastBroadReflectionAt: '2026-03-01T00:00:00.000Z',
      unresolvedOpenQuestionCount: 2,
      now: new Date('2026-03-20T00:00:00.000Z'),
    }),
    true
  );
});

test('calculateEditIntensity increases when phrasing shifts heavily', () => {
  const intensity = calculateEditIntensity(
    'Distribution is hard because attention is scarce.',
    'Distribution is architecture. Attention compounds only when the product is built for it.'
  );

  assert.equal(intensity > 0.4, true);
});

test('buildFeedbackSuggestion maps performative feedback into an anti-taste rule', () => {
  const suggestion = buildFeedbackSuggestion('too_performative');

  assert.ok(suggestion);
  assert.equal(suggestion?.kind, 'taste_avoid');
  assert.match(suggestion?.statement || '', /performative internet voice/i);
});
