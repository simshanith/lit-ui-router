import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  changedFiles,
  classifyFiles,
  formatReport,
  hasFileSetChange,
  isCleanDiff,
  isManifestDriftInert,
  manifestDriftFields,
  renderSummary,
  scopePackages,
  summarizeResults,
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

// Manifests as read from the two compared tarballs (tarballManifest): a
// files-glob-only edit (dot-dir negation) with an unchanged packed file set.
const PUBLISHED_MANIFEST = {
  name: 'lit-ui-router',
  version: '1.7.1',
  files: ['dist/**'],
  exports: './dist/index.js',
};
const LOCAL_MANIFEST_417 = {
  name: 'lit-ui-router',
  version: '1.7.1',
  files: ['dist/**', '!dist/.*/**'],
  exports: './dist/index.js',
};

// A modification-only diff: package.json changed, both sides present.
const MANIFEST_ONLY_DIFF = [
  '--- lit-ui-router@1.7.1/package/package.json',
  '+++ lit-ui-router-1.7.1.tgz/package/package.json',
  '@@ -4,1 +4,1 @@',
  '-  "files": ["dist/**"],',
  '+  "files": ["dist/**", "!dist/.*/**"],',
].join('\n');

describe('hasFileSetChange', () => {
  it('detects additions and deletions via /dev/null headers', () => {
    assert.equal(hasFileSetChange(DRIFT_DIFF), true); // dist/removed.js → /dev/null
  });

  it('is false when every changed file exists on both sides', () => {
    assert.equal(hasFileSetChange(MANIFEST_ONLY_DIFF), false);
  });
});

describe('manifestDriftFields', () => {
  it('lists exactly the top-level fields whose values differ', () => {
    assert.deepEqual(
      manifestDriftFields(PUBLISHED_MANIFEST, LOCAL_MANIFEST_417),
      ['files'],
    );
  });

  it('sees no drift across key-order differences', () => {
    const reordered = {
      exports: './dist/index.js',
      version: '1.7.1',
      name: 'lit-ui-router',
      files: ['dist/**'],
    };
    assert.deepEqual(manifestDriftFields(PUBLISHED_MANIFEST, reordered), []);
  });

  it('reports fields present on only one side', () => {
    assert.deepEqual(
      manifestDriftFields(PUBLISHED_MANIFEST, {
        ...PUBLISHED_MANIFEST,
        types: './dist/index.d.ts',
      }),
      ['types'],
    );
  });
});

describe('isManifestDriftInert', () => {
  it('files-only drift with an identical file set is inert', () => {
    assert.equal(
      isManifestDriftInert({
        fileSetChanged: hasFileSetChange(MANIFEST_ONLY_DIFF),
        driftFields: manifestDriftFields(
          PUBLISHED_MANIFEST,
          LOCAL_MANIFEST_417,
        ),
      }),
      true,
    );
  });

  it('a files change that alters the file set stays ship-affecting', () => {
    assert.equal(
      isManifestDriftInert({ fileSetChanged: true, driftFields: ['files'] }),
      false,
    );
  });

  it('any non-whitelisted field stays ship-affecting even with an identical file set', () => {
    assert.equal(
      isManifestDriftInert({
        fileSetChanged: false,
        driftFields: ['exports', 'files'],
      }),
      false,
    );
    assert.equal(
      isManifestDriftInert({ fileSetChanged: false, driftFields: ['types'] }),
      false,
    );
  });

  it('a formatting-only manifest diff (no field drift) is vacuously inert', () => {
    assert.equal(
      isManifestDriftInert({ fileSetChanged: false, driftFields: [] }),
      true,
    );
  });
});

describe('classifyFiles (manifest rule interplay)', () => {
  it('without a manifest diff, classification is unchanged: package.json stays ship-affecting', () => {
    assert.deepEqual(classifyFiles(['package.json', 'src/core.ts']), {
      shipAffecting: ['package.json'],
      shipInert: ['src/core.ts'],
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
    assert.match(text, /ship-inert drift vs 1\.7\.1 — 2 ship-inert file\(s\)/);
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

describe('scopePackages', () => {
  const publishable = ['lit-ui-router', 'lit-ui-router-mobx'];

  it('returns all publishable names when the scope is empty or unset', () => {
    assert.deepEqual(scopePackages(publishable, undefined), publishable);
    assert.deepEqual(scopePackages(publishable, ''), publishable);
    assert.deepEqual(scopePackages(publishable, ' , '), publishable);
  });

  it('filters to the comma-separated scope, whitespace-tolerant', () => {
    assert.deepEqual(scopePackages(publishable, ' lit-ui-router-mobx '), [
      'lit-ui-router-mobx',
    ]);
  });

  it('throws loudly on names matching no publishable member', () => {
    assert.throws(
      () => scopePackages(publishable, 'lit-ui-router,typo-pkg'),
      /PUBLISHED_DIFF_PACKAGES names no publishable member: typo-pkg/,
    );
  });
});

describe('summarizeResults', () => {
  it('maps every status to counts, published version, and a clean flag', () => {
    assert.deepEqual(
      summarizeResults([
        {
          name: 'lit-ui-router',
          dir: 'packages/lit-ui-router',
          latest: '1.7.0',
          localVersion: '1.7.0',
          status: 'clean',
        },
        {
          name: 'lit-ui-router-mobx',
          dir: 'packages/lit-ui-router-mobx',
          latest: '0.3.2',
          localVersion: '0.3.2',
          status: 'drift',
          files: ['dist/router-store.js', 'package.json'],
          shipInertFiles: ['src/router-store.ts'],
        },
        {
          name: 'ui-router-navigation-location-plugin',
          dir: 'packages/navigation-location-plugin',
          latest: '0.2.1',
          localVersion: '0.2.1',
          status: 'ship-inert',
          files: [],
          shipInertFiles: ['dist/core.js.map', 'src/core.ts'],
        },
        {
          name: 'ui-router-server',
          dir: 'packages/ui-router-server',
          localVersion: '0.0.0',
          status: 'unpublished',
        },
      ]),
      [
        {
          name: 'lit-ui-router',
          dir: 'packages/lit-ui-router',
          version: '1.7.0',
          shipAffecting: 0,
          shipInert: 0,
          clean: true,
          shipAffectingFiles: [],
          shipInertFiles: [],
        },
        {
          name: 'lit-ui-router-mobx',
          dir: 'packages/lit-ui-router-mobx',
          version: '0.3.2',
          shipAffecting: 2,
          shipInert: 1,
          clean: false,
          shipAffectingFiles: ['dist/router-store.js', 'package.json'],
          shipInertFiles: ['src/router-store.ts'],
        },
        {
          name: 'ui-router-navigation-location-plugin',
          dir: 'packages/navigation-location-plugin',
          version: '0.2.1',
          shipAffecting: 0,
          shipInert: 2,
          clean: true,
          shipAffectingFiles: [],
          shipInertFiles: ['dist/core.js.map', 'src/core.ts'],
        },
        {
          name: 'ui-router-server',
          dir: 'packages/ui-router-server',
          version: null,
          shipAffecting: 0,
          shipInert: 0,
          clean: true,
          shipAffectingFiles: [],
          shipInertFiles: [],
        },
      ],
    );
  });
});

describe('renderSummary', () => {
  it('renders canonical bytes: 2-space indent, trailing newline', () => {
    const rendered = renderSummary([
      {
        name: 'lit-ui-router',
        dir: 'packages/lit-ui-router',
        version: '1.7.0',
        shipAffecting: 0,
        shipInert: 0,
        clean: true,
        shipAffectingFiles: [],
        shipInertFiles: [],
      },
    ]);
    assert.equal(rendered.endsWith('\n'), true);
    assert.deepEqual(JSON.parse(rendered), [
      {
        name: 'lit-ui-router',
        dir: 'packages/lit-ui-router',
        version: '1.7.0',
        shipAffecting: 0,
        shipInert: 0,
        clean: true,
        shipAffectingFiles: [],
        shipInertFiles: [],
      },
    ]);
  });
});
