import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  catalogDepNames,
  collectInlineUsage,
  findViolations,
  formatReport,
  isInlineRegistryRange,
  type Violation,
} from './check-catalog.core.ts';

describe('isInlineRegistryRange', () => {
  it('accepts plain registry ranges and tags', () => {
    for (const spec of ['^1.2.3', '~2.0.0', '1.0.0', '>=3 <4', '*', 'latest']) {
      assert.equal(isInlineRegistryRange(spec), true, spec);
    }
  });

  it('rejects catalog, workspace, and other managed protocols', () => {
    for (const spec of [
      'catalog:',
      'catalog:publishedPeer',
      'workspace:*',
      'link:../x',
      'file:../x.tgz',
      'portal:../x',
      'npm:other@^1.0.0',
    ]) {
      assert.equal(isInlineRegistryRange(spec), false, spec);
    }
  });

  it('rejects git/url specifiers and non-strings', () => {
    for (const spec of [
      'git+https://example.com/x.git',
      'git://example.com/x.git',
      'github:user/repo',
      'https://example.com/x.tgz',
    ]) {
      assert.equal(isInlineRegistryRange(spec), false, spec);
    }
    for (const spec of ['', '   ', undefined, null, 42]) {
      assert.equal(isInlineRegistryRange(spec), false, String(spec));
    }
  });
});

const members = [
  {
    name: 'a',
    dir: 'apps/a',
    manifest: {
      dependencies: { lodash: '^4.17.21' },
      devDependencies: { vite: 'catalog:' },
    },
  },
  {
    name: 'b',
    dir: 'apps/b',
    manifest: {
      dependencies: { lodash: '^4.18.0' },
      devDependencies: { vite: 'catalog:' },
    },
  },
  {
    name: 'c',
    dir: 'packages/c',
    // catalogued lodash must not count as an inline consumer
    manifest: { dependencies: { lodash: 'catalog:', only: '^1.0.0' } },
  },
  {
    name: 'd',
    dir: 'packages/d',
    // same package declaring a dep twice counts as ONE consumer
    manifest: {
      dependencies: { dup: '^1.0.0' },
      peerDependencies: { dup: '^1.0.0' },
    },
  },
];

describe('collectInlineUsage + findViolations', () => {
  const usage = collectInlineUsage(members);
  const violations = findViolations(usage);
  const byDep = new Map(violations.map((v): [string, Violation] => [v.dep, v]));

  it('flags a dep declared inline by 2+ distinct packages', () => {
    assert.ok(byDep.has('lodash'));
    assert.equal(byDep.get('lodash')!.consumers.size, 2);
    assert.deepEqual(byDep.get('lodash')!.specs, ['^4.17.21', '^4.18.0']);
  });

  it('ignores catalog/workspace specifiers', () => {
    // vite is catalog: everywhere, lodash@c is catalog: -> only a & b counted
    assert.ok(!byDep.has('vite'));
  });

  it('does not flag single-consumer deps', () => {
    assert.ok(!byDep.has('only'));
  });

  it('counts multiple fields in one package as a single consumer', () => {
    assert.ok(!byDep.has('dup'));
    assert.equal(usage.get('dup')!.size, 1);
  });

  it('sorts violations by dependency name', () => {
    const sorted = [...violations.map((v) => v.dep)].sort((a, b) =>
      a.localeCompare(b),
    );
    assert.deepEqual(
      violations.map((v) => v.dep),
      sorted,
    );
  });
});

describe('catalogDepNames', () => {
  it('collects names from the default and named catalogs', () => {
    const names = catalogDepNames({
      catalog: { lit: '^3.0.0', lodash: '^4.0.0' },
      catalogs: { publishedPeer: { '@uirouter/core': '^6.0.0' } },
    });
    assert.deepEqual([...names].sort(), ['@uirouter/core', 'lit', 'lodash']);
  });

  it('tolerates a missing/empty manifest', () => {
    assert.equal(catalogDepNames(undefined).size, 0);
    assert.equal(catalogDepNames({}).size, 0);
  });
});

describe('formatReport', () => {
  it('reports success with the member count', () => {
    const { ok, text } = formatReport([], { memberCount: 8 });
    assert.equal(ok, true);
    assert.match(text, /✓ catalog check passed — 8 workspace packages/);
  });

  it('fails and suggests adding to the catalog when the dep is uncatalogued', () => {
    const violations = findViolations(collectInlineUsage(members));
    const { ok, text } = formatReport(violations, {
      memberCount: 4,
      catalogNames: new Set(),
    });
    assert.equal(ok, false);
    assert.match(
      text,
      /lodash — declared inline by 2 packages \(versions drift: \^4\.17\.21, \^4\.18\.0\)/,
    );
    assert.match(text, /add "lodash" to the `catalog:`/);
  });

  it('suggests replacing inline ranges when the dep is already catalogued', () => {
    const violations = findViolations(collectInlineUsage(members));
    const { text } = formatReport(violations, {
      memberCount: 4,
      catalogNames: new Set(['lodash']),
    });
    assert.match(
      text,
      /catalog already defines "lodash" — replace each inline range/,
    );
  });
});
