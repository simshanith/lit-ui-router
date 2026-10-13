import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type Advisory,
  type FloorAlias,
  type ListedDep,
  type ListedProject,
  atOrAbove,
  classify,
  floorAliases,
  floorSummary,
  partition,
} from './audit.core.ts';
import { parseLock } from './single-version.core.ts';

const lock = parseLock(`lockfileVersion: '9.0'

catalogs:
  default:
    hono:
      specifier: ^4.13.0
      version: 4.13.13
  peerFloor:
    hono-floor:
      specifier: npm:hono@4.0.0
      version: 4.0.0
  peerFloorPlugin:
    eslint-floor:
      specifier: npm:eslint@9.0.0
      version: 9.0.0

importers:

  packages/server:
    devDependencies:
      hono:
        specifier: 'catalog:'
        version: 4.13.13
      hono-floor:
        specifier: catalog:peerFloor
        version: hono@4.0.0

  packages/plugin:
    devDependencies:
      eslint-floor:
        specifier: catalog:peerFloorPlugin
        version: eslint@9.0.0
`);

const catalogs = {
  default: { hono: '^4.13.0' },
  publishedPeer: { hono: '^4.0.0', eslint: '^9.0.0 || ^10.0.0' },
};

const peers = new Map<string, Record<string, string>>([
  ['packages/server', { hono: 'catalog:publishedPeer' }],
  ['packages/plugin', { eslint: '^9.0.0' }],
]);

const floors = floorAliases(lock, catalogs, (importer) => peers.get(importer));

const dep = (
  from: string,
  version: string,
  children: Record<string, ListedDep> = {},
  deduped = false,
): ListedDep => ({
  from,
  version,
  path: `/store/${from}@${version}`,
  ...(deduped ? { deduped } : { dependencies: children }),
});

const projects: ListedProject[] = [
  {
    devDependencies: {
      hono: dep('hono', '4.13.13', { shared: dep('shared', '1.0.0') }),
      // pnpm prints a subtree once, then marks later sightings deduped
      'eslint-floor': dep('eslint', '9.0.0', {}, true),
      'hono-floor': dep('hono', '4.0.0', {
        shared: dep('shared', '1.0.0', {}, true),
      }),
    },
  },
  {
    devDependencies: {
      'eslint-floor': dep('eslint', '9.0.0', {
        espree: dep('espree', '9.0.0'),
      }),
    },
  },
];

const advisory = (
  module_name: string,
  version: string,
  patched_versions: string,
  severity: Advisory['severity'] = 'high',
): Advisory => ({
  module_name,
  severity,
  patched_versions,
  github_advisory_id: `GHSA-${module_name}`,
  title: `${module_name} issue`,
  url: 'https://example.test',
  findings: [{ version }],
});

describe('floorAliases', () => {
  it('reads peerFloor* catalogs and resolves each importer peer range', () => {
    assert.deepEqual(
      floors.map(({ importer, alias, catalog, name, version, peerRange }) => [
        importer,
        alias,
        catalog,
        `${name}@${version}`,
        peerRange,
      ]),
      [
        ['packages/server', 'hono-floor', 'peerFloor', 'hono@4.0.0', '^4.0.0'],
        [
          'packages/plugin',
          'eslint-floor',
          'peerFloorPlugin',
          'eslint@9.0.0',
          '^9.0.0',
        ],
      ],
    );
  });

  it('throws when an importer declares no peer range for its floor', () => {
    assert.throws(
      () => floorAliases(lock, catalogs, () => ({})),
      /hono-floor \(catalogs\.peerFloor\) floors hono/,
    );
  });
});

describe('partition', () => {
  const { real, floor } = partition(projects, floors);

  it('keeps floor alias targets and their own subtrees out of the real set', () => {
    assert.ok(real.has('hono@4.13.13'));
    assert.ok(!real.has('hono@4.0.0'));
    assert.deepEqual(
      [...(floor.get('hono@4.0.0') ?? [])],
      ['hono-floor (hono@4.0.0)'],
    );
  });

  it('follows a deduped floor edge into the subtree printed elsewhere', () => {
    assert.deepEqual(
      [...(floor.get('espree@9.0.0') ?? [])],
      ['eslint-floor (eslint@9.0.0)'],
    );
    assert.ok(!real.has('espree@9.0.0'));
  });

  it('counts a package reached both ways as real', () => {
    assert.ok(real.has('shared@1.0.0'));
    assert.ok(floor.has('shared@1.0.0'));
  });

  it('throws when a deduped node is never printed in full', () => {
    assert.throws(
      () =>
        partition(
          [{ dependencies: { gone: dep('gone', '1.0.0', {}, true) } }],
          [],
        ),
      /gone@1\.0\.0 deduped but never in full/,
    );
  });
});

describe('classify', () => {
  const split = partition(projects, floors);

  const run = (...advisories: Advisory[]) =>
    classify(advisories, split, floors);

  it('accepts a floor-only finding fixed inside the peer range', () => {
    const verdict = run(advisory('hono', '4.0.0', '>=4.12.4'));

    assert.equal(verdict.real.length, 0);
    assert.deepEqual(
      verdict.floorOnly.map(({ id, floors: labels }) => [id, labels]),
      [['hono@4.0.0', ['hono-floor (hono@4.0.0)']]],
    );
    assert.equal(verdict.unfixedInRange.length, 0);
  });

  it('flags a floor-only finding with no patched version in the peer range', () => {
    const verdict = run(
      advisory('hono', '4.0.0', '>=5.0.0'),
      advisory('hono', '4.0.0', '<0.0.0', 'low'),
    );

    assert.deepEqual(
      verdict.unfixedInRange.map(
        ({ advisory: { patched_versions }, floor }) => [
          patched_versions,
          floor.importer,
          floor.peerRange,
        ],
      ),
      [
        ['>=5.0.0', 'packages/server', '^4.0.0'],
        ['<0.0.0', 'packages/server', '^4.0.0'],
      ],
    );
  });

  it('does not range-check transitive floor-only findings', () => {
    const verdict = run(advisory('espree', '9.0.0', '<0.0.0'));

    assert.equal(verdict.floorOnly.length, 1);
    assert.equal(verdict.unfixedInRange.length, 0);
  });

  it('counts real-tree and unreached findings as real', () => {
    const verdict = run(
      advisory('hono', '4.13.13', '>=4.13.14'),
      advisory('shared', '1.0.0', '>=1.0.1'),
      advisory('unlisted', '1.0.0', '>=1.0.1'),
    );

    assert.deepEqual(
      verdict.real.map(({ id }) => id),
      ['hono@4.13.13', 'shared@1.0.0', 'unlisted@1.0.0'],
    );
    assert.equal(verdict.floorOnly.length, 0);
  });
});

describe('atOrAbove', () => {
  it('follows pnpm severity order', () => {
    assert.ok(atOrAbove('critical', 'high'));
    assert.ok(atOrAbove('high', 'high'));
    assert.ok(!atOrAbove('moderate', 'high'));
  });
});

describe('floorSummary', () => {
  it('counts accepted findings per alias, highest severity first', () => {
    const { floorOnly } = classify(
      [
        advisory('hono', '4.0.0', '>=4.2.0', 'moderate'),
        advisory('hono', '4.0.0', '>=4.3.0', 'high'),
        advisory('hono', '4.0.0', '>=4.4.0', 'moderate'),
      ],
      partition(projects, floors),
      floors satisfies FloorAlias[],
    );

    assert.deepEqual(floorSummary(floorOnly), [
      'hono-floor (hono@4.0.0): 3 accepted (1 high, 2 moderate)',
    ]);
  });
});
