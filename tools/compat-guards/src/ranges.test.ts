// Characterization: these examples ARE the documentation of the two range
// shapes. Changing an expectation here changes what the compat guards accept.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { caretFloor, coversMajor2 } from './ranges.ts';

describe('coversMajor2', () => {
  it('accepts a caret-2 comparator leading the range or an alternative', () => {
    for (const range of [
      '^2.0.0',
      '^2.7.0 || ^3.0.0',
      '^1.0.0 || ^2.0.0 || ^3.0.0',
    ]) {
      assert.equal(coversMajor2(range), true, range);
    }
  });

  it('rejects ranges without a caret-2 comparator', () => {
    for (const range of ['^3.0.0', '>=2.0.0', '2.x', '']) {
      assert.equal(coversMajor2(range), false, range);
    }
  });

  it('rejects a major whose digits merely start with 2', () => {
    // the caret in `\^2\.` is what excludes wider majors — the leading-boundary
    // alternation alone would not, since `^12.` never contains `^2.`
    for (const range of ['^12.0.0', '^20.0.0', '^1.0.0 || ^12.0.0']) {
      assert.equal(coversMajor2(range), false, range);
    }
  });

  it('requires the published `x || y` spelling exactly', () => {
    // what the leading-boundary alternation actually costs: semver accepts an
    // unspaced `||`, the guard fails closed on it
    for (const range of ['^1.0.0||^2.0.0', '^1.0.0 ||^2.0.0', '^2']) {
      assert.equal(coversMajor2(range), false, range);
    }
  });
});

describe('caretFloor', () => {
  it('extracts the version from a single caret range', () => {
    assert.equal(caretFloor('^1.7.0'), '1.7.0');
    assert.equal(caretFloor('^10.20.30'), '10.20.30');
  });

  it('reports every other shape as unsupported', () => {
    for (const range of [
      '^1.7',
      '~1.7.0',
      '^1.7.0 || ^2.0.0',
      '>=1.7.0',
      '1.7.0',
      '^1.7.0-rc.1',
      '',
    ]) {
      assert.equal(caretFloor(range), undefined, range);
    }
  });
});
