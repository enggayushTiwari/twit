import test from 'node:test';
import assert from 'node:assert/strict';
import { getReviewStatusLabel, isReadyToPost } from '../utils/review-status.ts';

test('maps opened in x to a user-facing label', () => {
  assert.equal(getReviewStatusLabel('OPENED_IN_X'), 'Opened in X');
});

test('only approved drafts are ready to post', () => {
  assert.equal(isReadyToPost('APPROVED'), true);
  assert.equal(isReadyToPost('OPENED_IN_X'), false);
  assert.equal(isReadyToPost('REJECTED'), false);
});
