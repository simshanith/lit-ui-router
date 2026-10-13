import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { PackageManifest } from '@tools/bootstrap/types.ts';

import {
  findPackedFileProblems,
  findPackedManifestViolations,
  findUnsubstitutedRefs,
  formatFileReport,
  formatPackedManifestReport,
  formatReport,
  type PackedMap,
} from './check-pack.core.ts';

describe('findUnsubstitutedRefs', () => {
  it('passes a fully substituted manifest', () => {
    const manifest = {
      dependencies: { '@uirouter/core': '^6.0.8', lit: '^3.0.0' },
      peerDependencies: { mobx: '^6.0.0', 'lit-ui-router': '^1.5.1' },
      devDependencies: { vitest: '^4.1.9' },
    };

    assert.deepEqual(findUnsubstitutedRefs(manifest), []);
  });

  it('flags catalog: refs in every dependency field', () => {
    const manifest = {
      dependencies: { lit: 'catalog:publishedPeer' },
      devDependencies: { vitest: 'catalog:' },
      peerDependencies: { mobx: 'catalog:' },
      optionalDependencies: { fsevents: 'catalog:' },
    };

    assert.deepEqual(findUnsubstitutedRefs(manifest), [
      { field: 'dependencies', dep: 'lit', spec: 'catalog:publishedPeer' },
      { field: 'devDependencies', dep: 'vitest', spec: 'catalog:' },
      { field: 'peerDependencies', dep: 'mobx', spec: 'catalog:' },
      { field: 'optionalDependencies', dep: 'fsevents', spec: 'catalog:' },
    ]);
  });

  it('flags workspace: refs', () => {
    const manifest = {
      peerDependencies: { 'lit-ui-router': 'workspace:^' },
    };

    assert.deepEqual(findUnsubstitutedRefs(manifest), [
      { field: 'peerDependencies', dep: 'lit-ui-router', spec: 'workspace:^' },
    ]);
  });

  it('ignores missing fields', () => {
    assert.deepEqual(findUnsubstitutedRefs({}), []);
    assert.deepEqual(findUnsubstitutedRefs(undefined), []);
  });

  it('names the declaration when a specifier is not a string', () => {
    // The bytes come from a tarball, so the string type is a claim, not a
    // fact. This check used to `continue`, which returned [] and reported the
    // package clean. The message is the contract: anyone who "fixes the crash"
    // by coercing instead of throwing has to delete an assertion to do it.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions, anti-slop/require-safety-comment-for-type-assertion -- deliberately ill-typed input for the error path
    const manifest = {
      dependencies: { odd: 42 },
    } as unknown as PackageManifest;

    assert.throws(() => findUnsubstitutedRefs(manifest), {
      name: 'TypeError',
      message: 'dependencies.odd: specifier is number, not a string',
    });
  });
});

describe('formatReport', () => {
  it('passes when every packed manifest is clean', () => {
    const { ok, text } = formatReport([
      { name: 'lit-ui-router', dir: 'packages/lit-ui-router', refs: [] },
      {
        name: 'lit-ui-router-mobx',
        dir: 'packages/lit-ui-router-mobx',
        refs: [],
      },
    ]);

    assert.equal(ok, true);
    assert.match(text, /✓ pack check passed — 2 publishable packages/);
  });

  it('fails and lists every leaked ref', () => {
    const { ok, text } = formatReport([
      { name: 'lit-ui-router', dir: 'packages/lit-ui-router', refs: [] },
      {
        name: 'lit-ui-router-mobx',
        dir: 'packages/lit-ui-router-mobx',
        refs: [
          {
            field: 'peerDependencies',
            dep: 'lit-ui-router',
            spec: 'workspace:^',
          },
          {
            field: 'peerDependencies',
            dep: 'lit',
            spec: 'catalog:publishedPeer',
          },
        ],
      },
    ]);

    assert.equal(ok, false);
    assert.match(text, /✗ pack check failed/);
    assert.match(text, /lit-ui-router-mobx \(packages\/lit-ui-router-mobx\)/);
    assert.match(text, /workspace:\^/);
    assert.match(text, /catalog:publishedPeer/);
    assert.doesNotMatch(text, /lit-ui-router \(packages\/lit-ui-router\)/);
  });

  it('fails when no publishable packages were found', () => {
    const { ok, text } = formatReport([]);
    assert.equal(ok, false);
    assert.match(text, /no publishable workspace packages/);
  });
});

describe('findPackedManifestViolations', () => {
  it('passes a clean packed manifest', () => {
    const manifest = {
      name: 'lit-ui-router',
      dependencies: { '@uirouter/core': '^6.0.8' },
      peerDependencies: { lit: '^3.0.0' },
    };

    assert.deepEqual(findPackedManifestViolations(manifest), []);
  });

  it('flags devDependencies, even when empty (the key should be deleted)', () => {
    assert.deepEqual(findPackedManifestViolations({ devDependencies: {} }), [
      'devDependencies leaked into packed manifest',
    ]);
  });

  it('flags scripts, even when empty (the key should be deleted)', () => {
    assert.deepEqual(findPackedManifestViolations({ scripts: {} }), [
      'scripts leaked into packed manifest',
    ]);
  });

  it('flags catalog:/workspace: anywhere in the runtime dependency fields', () => {
    assert.deepEqual(
      findPackedManifestViolations({
        dependencies: { lit: 'catalog:publishedPeer' },
      }),
      ['unsubstituted refs in packed manifest'],
    );
    assert.deepEqual(
      findPackedManifestViolations({
        peerDependencies: { 'lit-ui-router': 'workspace:^' },
      }),
      ['unsubstituted refs in packed manifest'],
    );
    // Substring semantics, blunter than findUnsubstitutedRefs's prefix test:
    // an aliased spec embedding the protocol mid-string still fails.
    assert.deepEqual(
      findPackedManifestViolations({
        optionalDependencies: { alias: 'npm:workspace:^1.0.0' },
      }),
      ['unsubstituted refs in packed manifest'],
    );
  });

  it('does not scan devDependencies for refs — their presence alone fails', () => {
    assert.deepEqual(
      findPackedManifestViolations({ devDependencies: { vitest: 'catalog:' } }),
      ['devDependencies leaked into packed manifest'],
    );
  });

  it('reports every violation class at once', () => {
    const manifest = {
      scripts: { build: 'turbo run build' },
      devDependencies: { vitest: '^4.1.9' },
      dependencies: { lit: 'catalog:publishedPeer' },
    };

    assert.deepEqual(findPackedManifestViolations(manifest), [
      'devDependencies leaked into packed manifest',
      'scripts leaked into packed manifest',
      'unsubstituted refs in packed manifest',
    ]);
  });

  it('ignores an empty manifest', () => {
    assert.deepEqual(findPackedManifestViolations({}), []);
  });
});

describe('formatPackedManifestReport', () => {
  it('passes when there are no violations', () => {
    const { ok, text } = formatPackedManifestReport([]);
    assert.equal(ok, true);
    assert.match(text, /packed manifest clean/);
  });

  it('fails and lists every violation', () => {
    const { ok, text } = formatPackedManifestReport([
      'devDependencies leaked into packed manifest',
      'scripts leaked into packed manifest',
    ]);

    assert.equal(ok, false);
    assert.match(text, /✗ packed manifest check failed/);
    assert.match(text, /devDependencies leaked/);
    assert.match(text, /scripts leaked/);
  });
});

describe('findPackedFileProblems', () => {
  const paths = [
    'package.json',
    'src/route-ref.ts',
    'dist/route-ref.js',
    'dist/route-ref.d.ts',
    'dist/route-ref.js.map',
    'dist/shared/route-snapshot.js',
    'dist/shared/route-snapshot.d.ts',
    'dist/shared/route-snapshot.js.map',
  ];

  const emitted = (text: string) => [{ path: 'dist/route-ref.js', text }];

  const noMaps = new Map<string, PackedMap>();

  it('passes imports that resolve to packed files or declarations', () => {
    assert.deepEqual(
      findPackedFileProblems(
        paths,
        [
          ...emitted(
            'import { a } from "effect";\nimport { s } from "./shared/route-snapshot.js";\n',
          ),
          {
            path: 'dist/shared/route-snapshot.d.ts',
            text: 'export { x } from "../route-ref.js";\n',
          },
        ],
        noMaps,
      ),
      [],
    );
  });

  it('flags a private @repo import in emitted code', () => {
    assert.deepEqual(
      findPackedFileProblems(
        paths,
        emitted('import { s } from "@repo/route-snapshot";'),
        noMaps,
      ),
      ['dist/route-ref.js: imports private @repo/route-snapshot'],
    );
  });

  it('flags a relative import the tarball lacks, static or dynamic', () => {
    assert.deepEqual(
      findPackedFileProblems(
        paths,
        emitted('export * from "./gone.js";\nawait import("./also-gone.js");'),
        noMaps,
      ),
      [
        'dist/route-ref.js: imports ./gone.js, which is not packed',
        'dist/route-ref.js: imports ./also-gone.js, which is not packed',
      ],
    );
  });

  it('skips shipped TypeScript sources, which are sourcemap referents only', () => {
    assert.deepEqual(
      findPackedFileProblems(
        paths,
        [{ path: 'src/route-ref.ts', text: "import '@repo/route-snapshot';" }],
        noMaps,
      ),
      [],
    );
  });

  it('passes map sources that are packed or embedded', () => {
    const maps = new Map<string, PackedMap>([
      ['dist/route-ref.js.map', { sources: ['../src/route-ref.ts'] }],
      [
        'dist/shared/route-snapshot.js.map',
        {
          sources: ['../../../shared/route-snapshot/src/route-snapshot.ts'],
          sourcesContent: ['export {};'],
        },
      ],
    ]);

    assert.deepEqual(findPackedFileProblems(paths, [], maps), []);
  });

  it('flags a map source that is neither packed nor embedded', () => {
    const maps = new Map<string, PackedMap>([
      ['dist/route-ref.js.map', { sources: ['../src/gone.ts'] }],
    ]);

    assert.deepEqual(findPackedFileProblems(paths, [], maps), [
      'dist/route-ref.js.map: source ../src/gone.ts is neither packed nor embedded',
    ]);
  });
});

describe('formatFileReport', () => {
  it('passes when no package has problems', () => {
    const { ok } = formatFileReport([{ name: 'a', problems: [] }]);

    assert.equal(ok, true);
  });

  it('fails and lists each package with its problems', () => {
    const { ok, text } = formatFileReport([
      { name: 'a', problems: [] },
      { name: 'b', problems: ['dist/x.js: imports private @repo/y'] },
    ]);

    assert.equal(ok, false);
    assert.match(text, /^ {2}b$/m);
    assert.match(text, /• dist\/x\.js: imports private @repo\/y/);
    assert.doesNotMatch(text, /^ {2}a$/m);
  });
});
