import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationSystemPrompt } from '../utils/generation.ts';

test('buildGenerationSystemPrompt includes profile and creator voice inputs', () => {
  const prompt = buildGenerationSystemPrompt({
    profile: {
      desired_perception: 'Calm technical operator',
      target_audience: 'Founders and engineers',
      tone_guardrails: 'No hype. No emojis.',
    },
    creatorPersona: {
      handle: 'naval',
      ai_voice_profile: 'Short sentences. Contrarian framing.',
    },
    sourceType: 'idea',
    contextIdeas: 'Distribution is a systems design problem.',
    pastTweets: 'Old tweet one',
    confirmedEntries: [],
    currentObsessions: [],
    recentEventPovs: [],
  });

  assert.match(prompt, /Calm technical operator/);
  assert.match(prompt, /No hype\. No emojis\./);
  assert.match(prompt, /@naval/);
  assert.match(prompt, /Contrarian framing\./);
  assert.match(prompt, /Distribution is a systems design problem\./);
});

test('buildGenerationSystemPrompt falls back cleanly without creator voice', () => {
  const prompt = buildGenerationSystemPrompt({
    profile: null,
    creatorPersona: null,
    sourceType: 'project_log',
    contextIdeas: 'Debugged a flaky queue worker.',
    pastTweets: 'None',
    confirmedEntries: [],
    currentObsessions: [],
    recentEventPovs: [],
  });

  assert.match(prompt, /REFERENCE VOICE: None selected/);
  assert.match(prompt, /project_log/);
});
