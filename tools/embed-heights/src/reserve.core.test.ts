import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FRAME_BORDER_PX,
  judge,
  MAX_HEIGHT_PX,
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

test('content taller than the cap is reserved at the cap', () => {
  const tall = MAX_HEIGHT_PX * 1.5;
  assert.ok(requiredFor(tall) > MAX_HEIGHT_PX);
  assert.equal(judge(tall, MAX_HEIGHT_PX).status, 'capped');
  assert.equal(judge(tall, MAX_HEIGHT_PX - 10).status, 'under');
  assert.equal(suggest(tall), MAX_HEIGHT_PX);
});

test('a declaration above the cap fails, even when content needs it', () => {
  assert.equal(judge(MAX_HEIGHT_PX * 1.5, MAX_HEIGHT_PX + 10).status, 'over');
  assert.equal(judge(400, MAX_HEIGHT_PX + 10).status, 'over');
});

test('below the cap the cap changes nothing', () => {
  const required = requiredFor(1000);
  assert.ok(required < MAX_HEIGHT_PX);
  assert.equal(judge(1000, required).status, 'ok');
  assert.equal(judge(1000, required - 1).status, 'under');
  assert.equal(judge(1000, MAX_HEIGHT_PX).status, 'ok');
  assert.equal(suggest(1000), 1040);
});
