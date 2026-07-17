import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  changedFiles,
  classifyFiles,
  formatReport,
  isCleanDiff,
} from './check-published-diff.core.ts';

// Shape of real `npm diff --diff=<spec> --diff=<tarball>` output: both sides
// carry the compared spec as prefix, paths inside the tarball under package/.
const DRIFT_DIFF = [
  'diff --git a/package/dist/index.js b/package/dist/index.js',
  'index 07f105a..a56241c 100644',
  '--- lit-ui-router-mobx@0.3.2/package/dist/router-store.js',
  '+++ lit-ui-router-mobx-0.3.2.tgz/package/dist/router-store.js',
  '@@ -1,3 +1,4 @@',
  '-old',
  '+new',
  '--- lit-ui-router-mobx@0.3.2/package/package.json',
  '+++ lit-ui-router-mobx-0.3.2.tgz/package/package.json',
  '@@ -10,2 +10,3 @@',
  '+  "keywords": [],',
  '--- lit-ui-router-mobx@0.3.2/package/dist/removed.js',
  '+++ /dev/null',
].join('\n');

describe('isCleanDiff', () => {
  it('treats empty and whitespace-only output as clean', () => {
    assert.equal(isCleanDiff(''), true);
    assert.equal(isCleanDiff('\n'), true);
  });

  it('treats any diff content as drift', () => {
    assert.equal(isCleanDiff(DRIFT_DIFF), false);
  });
});

describe('changedFiles', () => {
  it('extracts deduplicated tarball paths from header lines', () => {
    assert.deepEqual(changedFiles(DRIFT_DIFF), [
      'dist/removed.js',
      'dist/router-store.js',
      'package.json',
    ]);
  });

  it('returns nothing for an empty diff', () => {
    assert.deepEqual(changedFiles(''), []);
  });
});

describe('classifyFiles', () => {
  it('routes src and dist maps to ship-inert, everything else to ship-affecting', () => {
    assert.deepEqual(
      classifyFiles([
        'dist/core.js',
        'dist/core.js.map',
        'dist/core.d.ts',
        'dist/core.d.ts.map',
        'src/core.ts',
        'package.json',
      ]),
      {
        shipAffecting: ['dist/core.js', 'dist/core.d.ts', 'package.json'],
        shipInert: ['dist/core.js.map', 'dist/core.d.ts.map', 'src/core.ts'],
      },
    );
  });

  it('never treats a map-named source file as ship-inert', () => {
    // A real code change always also changes emitted js/d.ts, so ship-inert
    // entries alone can't mask ship-affecting drift.
    assert.deepEqual(classifyFiles(['dist/sourcemap-utils.js']), {
      shipAffecting: ['dist/sourcemap-utils.js'],
      shipInert: [],
    });
  });
});

describe('formatReport', () => {
  const clean = {
    name: 'lit-ui-router',
    dir: 'packages/lit-ui-router',
    latest: '1.7.0',
    localVersion: '1.7.0',
    status: 'clean' as const,
  };
  const drift = {
    name: 'lit-ui-router-mobx',
    dir: 'packages/lit-ui-router-mobx',
    latest: '0.3.2',
    localVersion: '0.3.2',
    status: 'drift' as const,
    files: ['dist/router-store.js', 'package.json'],
  };

  const shipInert = {
    name: 'lit-ui-router',
    dir: 'packages/lit-ui-router',
    latest: '1.7.1',
    localVersion: '1.7.1',
    status: 'ship-inert' as const,
    files: [],
    shipInertFiles: ['dist/core.js.map', 'src/core.ts'],
  };

  it('passes when every package matches its published tarball', () => {
    const { ok, text } = formatReport([clean]);
    assert.equal(ok, true);
    assert.match(
      text,
      /✓ published-diff check passed — 1 packages, no ship-affecting drift/,
    );
    assert.match(text, /lit-ui-router: clean vs 1\.7\.0/);
  });

  it('passes with ship-inert drift only — even strict', () => {
    const { ok, text } = formatReport([shipInert], { strict: true });
    assert.equal(ok, true);
    assert.match(text, /\(1 ship-inert\)/);
    assert.match(text, /src\/map drift vs 1\.7\.1 — 2 ship-inert file\(s\)/);
    assert.match(text, /◦ src\/core\.ts/);
  });

  it('lists ship-inert files under a drifting package without counting them', () => {
    const { text } = formatReport([
      { ...drift, shipInertFiles: ['src/router-store.ts'] },
    ]);
    assert.match(
      text,
      /SHIPS CHANGES vs 0\.3\.2 — 2 ship-affecting file\(s\):/,
    );
    assert.match(text, /◦ src\/router-store\.ts \(ship-inert\)/);
  });

  it('reports drift without failing by default', () => {
    const { ok, text } = formatReport([clean, drift]);
    assert.equal(ok, true);
    assert.match(text, /1 of 2 packages would ship changes/);
    assert.match(
      text,
      /SHIPS CHANGES vs 0\.3\.2 — 2 ship-affecting file\(s\):/,
    );
    assert.match(text, /• dist\/router-store\.js/);
  });

  it('fails on drift under --strict', () => {
    const { ok, text } = formatReport([clean, drift], { strict: true });
    assert.equal(ok, false);
    assert.match(text, /✗ published-diff check failed — 1 of 2 packages/);
  });

  it('flags a local version ahead of the published latest', () => {
    const { text } = formatReport([
      { ...clean, localVersion: '1.7.1', status: 'drift', files: [] },
    ]);
    assert.match(
      text,
      /local 1\.7\.1 ahead of published — release in flight\?/,
    );
  });

  it('skips unpublished packages without failing', () => {
    const { ok, text } = formatReport([
      clean,
      {
        name: 'ui-router-server',
        dir: 'packages/ui-router-server',
        localVersion: '0.0.0',
        status: 'unpublished' as const,
      },
    ]);
    assert.equal(ok, true);
    assert.match(text, /ui-router-server: never published — skipped/);
  });

  it('fails when no publishable packages were found', () => {
    const { ok, text } = formatReport([]);
    assert.equal(ok, false);
    assert.match(text, /no publishable workspace packages/);
  });
});
