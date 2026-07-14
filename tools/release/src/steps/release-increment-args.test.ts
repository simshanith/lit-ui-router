import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { incrementArgs } from './release-increment-args.core.ts';

// Baseline equivalence: expectations below for major/minor/patch/other/none
// match the argv the workflow's old GITHUB_ENV string + `read -a` round-trip
// produced for the same inputs (captured before the extraction).

describe('incrementArgs', () => {
  it('maps each standard choice-list increment to an --increment flag', () => {
    // every non-custom value bump-version.yml's `options` list offers
    assert.deepEqual(incrementArgs('major', ''), ['--increment', 'major']);
    assert.deepEqual(incrementArgs('minor', ''), ['--increment', 'minor']);
    assert.deepEqual(incrementArgs('patch', ''), ['--increment', 'patch']);
  });

  it('ignores a stray `other` value alongside a standard increment', () => {
    // the old shell never looked at OTHER_INCREMENT on this branch
    assert.deepEqual(incrementArgs('patch', '9.9.9'), ['--increment', 'patch']);
  });

  it('passes a custom version through --increment', () => {
    assert.deepEqual(incrementArgs('other', '1.2.3'), ['--increment', '1.2.3']);
    assert.deepEqual(incrementArgs('other', '1.0.3-alpha.0'), [
      '--increment',
      '1.0.3-alpha.0',
    ]);
    assert.deepEqual(incrementArgs('other', '2.0.0-rc.1+build.5'), [
      '--increment',
      '2.0.0-rc.1+build.5',
    ]);
  });

  it('accepts the semver pre-increment keywords the choice list lacks', () => {
    for (const kw of ['premajor', 'preminor', 'prepatch', 'prerelease']) {
      assert.deepEqual(incrementArgs('other', kw), ['--increment', kw]);
    }
  });

  it('trims surrounding whitespace like the old word-splitting did', () => {
    assert.deepEqual(incrementArgs('other', '  1.2.3 '), [
      '--increment',
      '1.2.3',
    ]);
  });

  it('produces no args for none without other (use current version)', () => {
    assert.deepEqual(incrementArgs('none', ''), []);
    assert.deepEqual(incrementArgs('none', '   '), []);
  });

  it('pins none+other passing the version POSITIONALLY, not via flag', () => {
    // odd but load-bearing: the workflow has always emitted the bare value
    assert.deepEqual(incrementArgs('none', '1.2.3'), ['1.2.3']);
    assert.deepEqual(incrementArgs('none', 'prerelease'), ['prerelease']);
  });

  it('rejects flag injection through the free-text other input', () => {
    // pre-extraction these word-split into extra release-it argv
    assert.throws(
      () =>
        incrementArgs('other', '1.2.3 --no-git.requireCleanWorkingDir --ci'),
      /invalid 'other' increment "1\.2\.3 --no-git\.requireCleanWorkingDir --ci"/,
    );
    assert.throws(
      () => incrementArgs('none', '--ci --no-npm'),
      /invalid 'other' increment/,
    );
    assert.throws(
      () => incrementArgs('other', '--preRelease=alpha'),
      /invalid 'other' increment/,
    );
  });

  it('rejects non-semver other values with the offending value in the error', () => {
    for (const bad of ['v1.2.3', '1.2', 'latest', 'major.minor']) {
      assert.throws(
        () => incrementArgs('other', bad),
        new RegExp(`invalid 'other' increment "${bad.replace(/\./g, '\\.')}"`),
      );
    }
  });

  it('rejects other-mode without a value (was a broken bare --increment)', () => {
    assert.throws(() => incrementArgs('other', ''), /invalid 'other'/);
    assert.throws(() => incrementArgs('other', '  '), /invalid 'other'/);
  });

  it('rejects increments outside the workflow choice list', () => {
    assert.throws(() => incrementArgs('', ''), /unknown increment ""/);
    assert.throws(
      () => incrementArgs('--help', ''),
      /unknown increment "--help"/,
    );
  });
});
