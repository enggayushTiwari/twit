import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseConversationArchetype,
  getDefaultNarrativePillars,
  inferPillarLabel,
  isXEligibleClassification,
} from '../utils/distribution.ts';

test('private thoughts are excluded from X-eligible generation', () => {
  assert.equal(isXEligibleClassification('private_thought'), false);
  assert.equal(isXEligibleClassification('proof'), true);
});

test('default narrative pillars include the core company image lanes', () => {
  const pillars = getDefaultNarrativePillars().map((pillar) => pillar.label);
  assert.deepEqual(pillars, [
    'Company vision',
    'Customer pain',
    'Build/progress',
    'Proof/results',
    'Category POV',
  ]);
});

test('inferPillarLabel maps proof-style content to the proof pillar', () => {
  const label = inferPillarLabel({
    classification: 'proof',
    content: 'We hit a clear usage milestone this week.',
    availablePillars: [{ label: 'Proof/results' }],
  });

  assert.equal(label, 'proof/results');
});

test('chooseConversationArchetype prefers clean disagreement for disagreement-shaped replies', () => {
  const archetype = chooseConversationArchetype({
    draftKind: 'reply',
    recommendedAction: 'reply',
    content: 'This take is wrong because it ignores the actual workflow constraints.',
    recentArchetypes: ['add_specific_example'],
  });

  assert.equal(archetype, 'disagree_cleanly');
});
