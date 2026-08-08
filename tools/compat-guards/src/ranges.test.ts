// Characterization: these examples ARE the documentation of the three range
// questions. Changing an expectation here changes what the compat guards accept.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { coversMajor2, isReadableRange, rangeFloor } from './ranges.ts';

describe('isReadableRange', () => {
  it('accepts the range spellings semver parses', () => {
    for (const range of [
      '^2.0.0',
      '~1.7.0',
      '>=1.7.0',
      '1.7.0',
      '*',
      '^1 || ^2',
    ]) {
      assert.equal(isReadableRange(range), true, range);
    }
  });

  it('rejects blank, which semver would otherwise read as `*`', () => {
    for (const range of ['', '   ']) {
      assert.equal(isReadableRange(range), false, range);
    }
  });

  it('rejects unparseable ranges, so a typo cannot read as a real answer', () => {
    // guard.range() fails on these; without it `^1.7.0 || garbage` would reach
    // coversMajor2, come back false, and advise dropping the lit2 compat lane
    for (const range of ['not-a-range', '^1.7.0 || garbage', '^^1.0.0']) {
      assert.equal(isReadableRange(range), false, range);
    }
  });
});

describe('coversMajor2', () => {
  it('accepts any range overlapping 2.x, whatever its spelling', () => {
    for (const range of [
      '^2.0.0',
      '^2.7.0 || ^3.0.0',
      '^1.0.0 || ^2.0.0 || ^3.0.0',
      '^1.0.0||^2.0.0',
      '^1.0.0 ||^2.0.0',
      '^2',
      '2.x',
      '>=2.0.0',
    ]) {
      assert.equal(coversMajor2(range), true, range);
    }
  });

  it('rejects ranges that never reach 2.x', () => {
    for (const range of [
      '^3.0.0',
      '^1.0.0',
      '^12.0.0',
      '^20.0.0',
      '^1.0.0 || ^12.0.0',
    ]) {
      assert.equal(coversMajor2(range), false, range);
    }
  });

  it('fails closed on blank and malformed ranges', () => {
    for (const range of ['', '   ', 'not a range', '^^2']) {
      assert.equal(coversMajor2(range), false, range);
    }
  });
});

describe('rangeFloor', () => {
  it('names the lowest version a range admits', () => {
    assert.equal(rangeFloor('^1.7.0'), '1.7.0');
    assert.equal(rangeFloor('^10.20.30'), '10.20.30');
    assert.equal(rangeFloor('^1.7'), '1.7.0');
    assert.equal(rangeFloor('~1.7.0'), '1.7.0');
    assert.equal(rangeFloor('>=1.7.0'), '1.7.0');
    assert.equal(rangeFloor('1.7.0'), '1.7.0');
    assert.equal(rangeFloor('^1.7.0 || ^2.0.0'), '1.7.0');
  });

  it('keeps a prerelease floor as the floor', () => {
    // flows on to the guard's `installed !== floor` compare, which the old
    // caret-only shape used to reject outright
    assert.equal(rangeFloor('^1.7.0-rc.1'), '1.7.0-rc.1');
  });

  it('fails closed on blank and malformed ranges', () => {
    for (const range of ['', '   ', 'not a range', '^^1.7.0']) {
      assert.equal(rangeFloor(range), undefined, range);
    }
  });
});
