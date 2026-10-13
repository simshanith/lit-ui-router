import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertNoCollision,
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

describe('assertNoCollision', () => {
  it('passes when no own emit shares the inlined path', () => {
    assert.doesNotThrow(() => assertNoCollision(['index'], [snapshot]));
  });

  it('fails when src/ already emits the inlined path', () => {
    assert.throws(
      () => assertNoCollision(['index', 'shared/route-snapshot'], [snapshot]),
      /already emits/,
    );
  });
});
