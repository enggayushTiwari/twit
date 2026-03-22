import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStartupCandidateGenerationPrompt,
  buildStartupCriticPrompt,
  buildStartupGenerationSystemPrompt,
} from '../utils/generation.ts';

test('buildStartupGenerationSystemPrompt centers startup clarity while preserving worldview', () => {
  const prompt = buildStartupGenerationSystemPrompt({
    startupProfile: {
      id: 'startup-1',
      startup_name: 'Idea Engine',
      one_liner: 'Turns raw founder thinking into publishable public content.',
      target_customer: 'Founders who want help externalizing their thinking',
      painful_problem: 'Their best ideas stay trapped in their head or product docs',
      transformation: 'They can publish clear thoughts faster without sounding fake',
      positioning: 'A self-modeling content system, not a generic AI writer',
      proof_points: 'Used daily to turn internal notes into external content',
      objections: 'People will think it is just another tweet generator',
      language_guardrails: 'Use plain customer language, avoid builder jargon',
      updated_at: '2026-03-22T00:00:00.000Z',
    },
    startupContext: 'Startup Context 1:\nUsers do not need more blank editors. They need help extracting what they already know.',
    sharedMindModel: [
      {
        id: 'belief-1',
        kind: 'belief',
        statement: 'Distribution is product architecture, not just marketing.',
        status: 'confirmed',
        confidence: 0.8,
        priority: 3,
        source_type: 'test',
        source_ref_id: null,
        tags: [],
        evidence_summary: '',
        created_at: '2026-03-22T00:00:00.000Z',
        updated_at: '2026-03-22T00:00:00.000Z',
      },
    ],
    startupReflections: ['Prompt: What changes after using it?\nAnswer: Founders can publish more of what they already believe.'],
    recentStartupTweets: 'Old startup tweet',
  });

  assert.match(prompt, /generate tweets about Idea Engine/i);
  assert.match(prompt, /Optimize for customers\/public first/i);
  assert.match(prompt, /Distribution is product architecture/i);
  assert.match(prompt, /avoid builder jargon/i);
});

test('startup candidate prompt asks for startup communication angles', () => {
  const prompt = buildStartupCandidateGenerationPrompt({
    seedIdea: 'Users need help turning scattered founder notes into public-facing clarity.',
  });

  assert.match(prompt, /problem clarity/i);
  assert.match(prompt, /customer transformation/i);
  assert.match(prompt, /objection handling/i);
});

test('startup critic prompt scores for clarity and distribution usefulness', () => {
  const prompt = buildStartupCriticPrompt('{"candidates": []}');

  assert.match(prompt, /customer\/public clarity/i);
  assert.match(prompt, /usefulness for distribution/i);
  assert.match(prompt, /avoidance of unnecessary builder jargon/i);
});
