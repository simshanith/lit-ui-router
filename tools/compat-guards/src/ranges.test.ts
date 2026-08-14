// Characterization: these examples ARE the documentation of the range
// questions. Changing an expectation here changes what the compat guards
// accept.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  coversMajor2,
  isBoundedRange,
  rangeFloor,
  rangeLegs,
} from './ranges.ts';

// Everything semver normalizes to `*`. Spelled out because the family is wider
// than it looks and each member was a fail-open at some point: '' and '   ' by
// semver's own `|| '*'` fallback, '||' and 'x' because a range with no
// comparators in it is an unbounded range, and '>=0.0.0' because semver
// simplifies it -- the rule catches deliberately-unbounded spellings, not just
// typos, which is the intent (a peer range that admits everything is a bug
// whether or not it was meant).
const UNBOUNDED = [
  '',
  '   ',
  '*',
  'x',
  'X',
  '||',
  '|| ||',
  '  ||  ',
  '>=0.0.0',
];

describe('isBoundedRange', () => {
  it('accepts the range spellings semver parses', () => {
    for (const range of [
      '^2.0.0',
      '~1.7.0',
      '>=1.7.0',
      '1.7.0',
      '^1 || ^2',
      '>=0.0.1',
    ]) {
      assert.equal(isBoundedRange(range), true, range);
    }
  });

  it('rejects every range that constrains nothing', () => {
    // a catalog range is hand-written config; `*` is never a legitimate value
    // there, so an input semver reads as `*` is a typo, not an answer
    for (const range of UNBOUNDED) {
      assert.equal(isBoundedRange(range), false, range);
    }
  });

  it('rejects unparseable ranges, so a typo cannot read as a real answer', () => {
    // guard.range() fails on these; without it `^1.7.0 || garbage` would reach
    // coversMajor2, come back false, and advise dropping the lit2 compat lane
    for (const range of ['not-a-range', '^1.7.0 || garbage', '^^1.0.0']) {
      assert.equal(isBoundedRange(range), false, range);
    }
  });
});

describe('rangeLegs', () => {
  it('counts the `||`-separated legs', () => {
    assert.equal(rangeLegs('^1.7.0'), 1);
    assert.equal(rangeLegs('>=1.7.0 <3'), 1);
    assert.equal(rangeLegs('^1.7.0 || ^2.0.0'), 2);
    assert.equal(rangeLegs('^1.0.0 || ^2.0.0 || ^3.0.0'), 3);
  });

  it('reports 0 for ranges that name no bound', () => {
    // 0 rather than 1: peer-floor-guard refuses anything but exactly 1, so an
    // unreadable range must not look like the single-leg case
    for (const range of [...UNBOUNDED, 'not-a-range']) {
      assert.equal(rangeLegs(range), 0, range);
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

  it('rejects a 2.x prerelease, which `^2.0.0` genuinely excludes', () => {
    // not a bug to fix later: 2.0.0-rc.1 < 2.0.0, so it is outside the range
    assert.equal(coversMajor2('2.0.0-rc.1'), false);
  });

  it('fails closed on unbounded and malformed ranges', () => {
    for (const range of [...UNBOUNDED, 'not a range', '^^2']) {
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
  });

  it('names only the lowest leg of a multi-leg range', () => {
    // true but not the whole truth, which is why peer-floor-guard refuses a
    // multi-leg range outright instead of typechecking against this
    assert.equal(rangeFloor('^1.7.0 || ^2.0.0'), '1.7.0');
  });

  it('keeps a prerelease floor as the floor', () => {
    // flows on to the guard's `installed !== floor` compare, which the old
    // caret-only shape used to reject outright
    assert.equal(rangeFloor('^1.7.0-rc.1'), '1.7.0-rc.1');
  });

  it('fails closed on unbounded and malformed ranges', () => {
    for (const range of [...UNBOUNDED, 'not a range', '^^1.7.0']) {
      assert.equal(rangeFloor(range), undefined, range);
    }
  });
});
