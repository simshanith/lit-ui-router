import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FRAME_BORDER_PX,
  judge,
  parsePx,
  requiredFor,
  suggest,
} from './reserve.core.ts';

test('parsePx reads the manifest heights', () => {
  assert.equal(parsePx('800px'), 800);
  assert.equal(parsePx(' 180px '), 180);
  assert.throws(() => parsePx('100%'));
  assert.throws(() => parsePx('800'));
});

test('a reservation must cover the content, the border and engine drift', () => {
  const required = requiredFor(768);
  assert.equal(judge(768, required).status, 'ok');
  assert.equal(judge(768, required - 1).status, 'under');
});

// This browser is not the one readers use, and it measures low. Reserving
// exactly what it saw is the failure the headroom exists to prevent.
test('matching the measurement exactly is not enough', () => {
  assert.equal(judge(768, 768 + FRAME_BORDER_PX).status, 'under');
  assert.ok(requiredFor(768) > 768 + FRAME_BORDER_PX);
});

test('deliberate slack passes; an abandoned reservation does not', () => {
  assert.equal(judge(420, 520).status, 'ok');
  assert.equal(judge(200, 900).status, 'stale');
});

test('suggestions carry headroom and land on a round number', () => {
  assert.equal(suggest(768), 800);
  assert.equal(suggest(869), 900);
  assert.ok(suggest(768) > 768 + FRAME_BORDER_PX);
});
