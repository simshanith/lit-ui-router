import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertNoCollision,
  exportedFiles,
  rewriteInlined,
  type InlinedSource,
} from './inline.ts';

const snapshot: InlinedSource = {
  specifier: '@repo/route-snapshot',
  file: '../shared/route-snapshot/src/route-snapshot.ts',
  stem: 'shared/route-snapshot',
};

describe('rewriteInlined', () => {
  it('points a top-level import at the sibling shared dir', () => {
    assert.equal(
      rewriteInlined(
        'import { snapshotRoute } from "@repo/route-snapshot";\n',
        'route-ref',
        [snapshot],
      ),
      'import { snapshotRoute } from "./shared/route-snapshot.js";\n',
    );
  });

  it('climbs out of a nested emit', () => {
    assert.equal(
      rewriteInlined(
        'export { type RouteSnapshot } from "@repo/route-snapshot";\n',
        'controllers/route',
        [snapshot],
      ),
      'export { type RouteSnapshot } from "../shared/route-snapshot.js";\n',
    );
  });

  it('rewrites dynamic imports', () => {
    assert.equal(
      rewriteInlined('await import("@repo/route-snapshot")', 'index', [
        snapshot,
      ]),
      'await import("./shared/route-snapshot.js")',
    );
  });

  it('leaves other bare specifiers alone', () => {
    const code = 'import { UIRouter } from "@uirouter/core";\n';

    assert.equal(rewriteInlined(code, 'index', [snapshot]), code);
  });

  it('fails on an @repo import the manifest does not declare', () => {
    assert.throws(
      () => rewriteInlined('import "x" from "@repo/other";', 'index', []),
      /@repo\/other, which package\.json does not list/,
    );
  });
});

describe('exportedFiles', () => {
  it('names each subpath by the specifier a consumer imports', () => {
    assert.deepEqual(
      exportedFiles('@repo/dev-gate', {
        '.': './src/dev-gate.ts',
        './node': './src/dev-gate.node.ts',
      }),
      [
        ['@repo/dev-gate', './src/dev-gate.ts'],
        ['@repo/dev-gate/node', './src/dev-gate.node.ts'],
      ],
    );
  });

  it('fails on a manifest without exports', () => {
    assert.throws(
      () => exportedFiles('@repo/none', undefined),
      /@repo\/none: exports must name/,
    );
  });

  it('fails on a subpath that names anything but one .ts file', () => {
    assert.throws(
      () =>
        exportedFiles('@repo/dev-gate', {
          '.': './src/dev-gate.ts',
          './node': { node: './src/dev-gate.node.ts' },
        }),
      /exports\["\.\/node"\] must name one \.ts file/,
    );
  });
});

describe('assertNoCollision', () => {
  it('passes when no own emit shares the inlined path', () => {
    assert.doesNotThrow(() => assertNoCollision(['index'], [snapshot]));
  });

  it('fails when src/ already emits the inlined path', () => {
    assert.throws(
      () => assertNoCollision(['index', 'shared/route-snapshot'], [snapshot]),
      /which src\/ already emits/,
    );
  });

  it('fails when two inlined sources share a path', () => {
    assert.throws(
      () =>
        assertNoCollision(
          ['index'],
          [snapshot, { ...snapshot, specifier: '@repo/other' }],
        ),
      /@repo\/other inlines to shared\/route-snapshot, which @repo\/route-snapshot already emits/,
    );
  });
});
