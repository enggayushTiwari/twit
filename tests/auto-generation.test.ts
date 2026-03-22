import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_GENERATION_INTERVAL_MINUTES,
  isAutoGenerationDue,
} from '../utils/auto-generation.ts';

test('auto-generation interval is set to 4.5 hours', () => {
  assert.equal(AUTO_GENERATION_INTERVAL_MINUTES, 270);
});

test('isAutoGenerationDue returns true when there is no previous generation timestamp', () => {
  assert.equal(isAutoGenerationDue(null, new Date('2026-03-22T10:00:00.000Z')), true);
});

test('isAutoGenerationDue returns false before the 4.5-hour interval has elapsed', () => {
  assert.equal(
    isAutoGenerationDue('2026-03-22T08:00:00.000Z', new Date('2026-03-22T12:00:00.000Z')),
    false
  );
});

test('isAutoGenerationDue returns true after the 4.5-hour interval has elapsed', () => {
  assert.equal(
    isAutoGenerationDue('2026-03-22T08:00:00.000Z', new Date('2026-03-22T12:31:00.000Z')),
    true
  );
});
