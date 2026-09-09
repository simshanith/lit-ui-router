import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type PackageSources,
  evidenceFor,
  formatFindings,
  importedPackages,
  packageOf,
  unusedDeps,
} from './workspace-deps.core.ts';

const sources = (over: Partial<PackageSources> = {}): PackageSources => ({
  modules: new Map(),
  other: new Map(),
  scripts: [],
  miseRuns: [],
  ...over,
});

describe('packageOf', () => {
  it('keeps both segments of a scoped name', () => {
    assert.equal(packageOf('@tools/shared/workspace.ts'), '@tools/shared');
    assert.equal(packageOf('@tools/shared'), '@tools/shared');
  });

  it('takes the first segment of an unscoped name', () => {
    assert.equal(packageOf('typescript'), 'typescript');
    assert.equal(packageOf('diff/lib/patch.js'), 'diff');
  });

  it('ignores anything that is not a bare package', () => {
    for (const specifier of ['./sibling.ts', '../up.ts', '/abs', 'node:fs']) {
      assert.equal(packageOf(specifier), undefined);
    }
    // a bare `@scope` is not resolvable, so it names no package
    assert.equal(packageOf('@tools'), undefined);
  });

  it('ignores subpath imports, which resolve inside the package', () => {
    assert.equal(packageOf('#internal/thing.ts'), undefined);
  });
});

describe('importedPackages', () => {
  it('finds every form the loader can reach', () => {
    const found = importedPackages(`
      import a from '@tools/one';
      import type { T } from '@tools/two';
      export { b } from '@tools/three';
      const c = await import('@tools/four');
      require('@tools/five');
      import '@tools/six';
    `);
    assert.deepEqual([...found].sort(), [
      '@tools/five',
      '@tools/four',
      '@tools/one',
      '@tools/six',
      '@tools/three',
      '@tools/two',
    ]);
  });

  // A type-only import still needs the dependency declared, so it is use.
  it('counts a type-only import as use', () => {
    assert.ok(
      importedPackages("import type { T } from '@tools/types';").has(
        '@tools/types',
      ),
    );
  });

  it('does not count relative siblings', () => {
    assert.deepEqual([...importedPackages("import x from './local.ts';")], []);
  });
});

describe('evidenceFor', () => {
  it('reports the file an import came from', () => {
    const found = evidenceFor(
      '@tools/shared',
      [],
      sources({ modules: new Map([['src/a.ts', "import '@tools/shared';"]]) }),
    );
    assert.deepEqual(found, { kind: 'import', where: 'src/a.ts' });
  });

  // The case that made this check permissive: www names the sample apps as
  // `node_modules/<name>/dist/...` inside a vite config, never as an import.
  it('counts a name inside a path in a config', () => {
    const found = evidenceFor(
      'sample-app-lit-vanilla',
      [],
      sources({
        other: new Map([
          [
            'vite.config.ts',
            "src: 'node_modules/sample-app-lit-vanilla/dist/index.html'",
          ],
        ]),
      }),
    );
    assert.equal(found?.kind, 'reference');
  });

  it('counts a binary invoked from a script', () => {
    const found = evidenceFor(
      '@tools/vue-check',
      ['vue-check'],
      sources({ scripts: ['vue-check --strict'] }),
    );
    assert.deepEqual(found, { kind: 'bin', where: 'script: vue-check' });
  });

  it('counts a binary invoked from a mise task', () => {
    const found = evidenceFor(
      '@tools/vue-check',
      ['vue-check'],
      sources({ miseRuns: ['set -e\nvue-check\n'] }),
    );
    assert.equal(found?.kind, 'bin');
  });

  it('does not let a longer name vouch for a shorter one', () => {
    const found = evidenceFor(
      'sample-app',
      [],
      sources({ other: new Map([['a.md', 'see sample-app-lit-mobx']]) }),
    );
    assert.equal(found, undefined);
  });

  it('does not let a binary name match inside a longer word', () => {
    const found = evidenceFor(
      '@tools/vue-check',
      ['vue-check'],
      sources({ scripts: ['run-vue-checker'] }),
    );
    assert.equal(found, undefined);
  });

  it('is undefined when the name appears nowhere', () => {
    assert.equal(
      evidenceFor(
        '@tools/shared',
        [],
        sources({
          modules: new Map([['a.ts', "import '@tools/other';"]]),
        }),
      ),
      undefined,
    );
  });
});

describe('unusedDeps', () => {
  const declared = [
    { name: '@tools/used', block: 'devDependencies' },
    { name: '@tools/stale', block: 'dependencies' },
  ];

  it('returns only the declarations with no evidence', () => {
    const findings = unusedDeps(
      '@tools/probe',
      declared,
      () => [],
      sources({ modules: new Map([['a.ts', "import '@tools/used';"]]) }),
    );
    assert.deepEqual(findings, [{ pkg: '@tools/probe', dep: declared[1] }]);
  });

  it('returns nothing when every declaration is used', () => {
    const findings = unusedDeps(
      '@tools/probe',
      declared,
      () => [],
      sources({
        modules: new Map([
          ['a.ts', "import '@tools/used';\nimport '@tools/stale';"],
        ]),
      }),
    );
    assert.deepEqual(findings, []);
  });
});

describe('formatFindings', () => {
  it('names the package, the dependency and its block', () => {
    const message = formatFindings([
      {
        pkg: '@tools/probe',
        dep: { name: '@tools/shared', block: 'devDependencies' },
      },
    ]);
    assert.match(message, /1 unused workspace dependency:/);
    assert.match(message, /@tools\/probe: @tools\/shared \(devDependencies\)/);
    // the message has to say why deleting it matters, or it reads as pedantry
    assert.match(message, /rehashes/);
  });

  it('pluralises on more than one', () => {
    const message = formatFindings([
      { pkg: 'a', dep: { name: 'x', block: 'dependencies' } },
      { pkg: 'b', dep: { name: 'y', block: 'dependencies' } },
    ]);
    assert.match(message, /2 unused workspace dependencies:/);
  });
});
