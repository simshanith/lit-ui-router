import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { defaultSuites, groupSuites, suites } from './suites.ts';

describe('defaultSuites', () => {
  it('is every suite but the named-only axe pass and domain-search harness', () => {
    const namedOnly = ['a11y', 'domain-search'];

    for (const suite of namedOnly) {
      assert.ok(suites.includes(suite));
      assert.ok(!defaultSuites.includes(suite));
    }

    assert.deepEqual(
      defaultSuites,
      suites.filter((suite) => !namedOnly.includes(suite)),
    );
  });
});

describe('groupSuites', () => {
  const names = [
    'docs',
    'effect',
    'hash',
    'mobx',
    'pushstate',
    'signals',
    'vanilla',
  ];

  it('gives each suite its own group at one per group', () => {
    assert.deepEqual(
      groupSuites(names, 1),
      names.map((name) => [name]),
    );
  });

  it('leaves the remainder in the last group', () => {
    assert.deepEqual(groupSuites(names, 3), [
      ['docs', 'effect', 'hash'],
      ['mobx', 'pushstate', 'signals'],
      ['vanilla'],
    ]);
  });

  it('puts everything in one group when the size covers the set', () => {
    assert.deepEqual(groupSuites(names, 10), [names]);
  });

  it('plans no groups for no suites', () => {
    assert.deepEqual(groupSuites([], 3), []);
  });

  it('rejects a size that is not a positive integer', () => {
    for (const size of [0, -1, 1.5, Number.NaN]) {
      assert.throws(() => groupSuites(names, size), RangeError);
    }
  });
});
