import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as v from 'valibot';

import { PACKAGES } from '../../catalog/packages.ts';
import {
  BUNDLED_MANIFEST,
  bannerKind,
  lineProblems,
  menuVersions,
  packageLines,
  pagePath,
  VersionManifest as VersionManifestSchema,
  sameVersionPage,
  versionOf,
  type VersionManifest,
} from '../versions.ts';

const latest = { id: 'latest', label: 'latest', path: '/' };

const main = { id: 'main', label: 'main', path: '/main/' };

const v1 = { id: 'v1', label: '1.x', path: '/v1/' };

const manifest: VersionManifest = {
  current: latest,
  others: [main, v1],
  deprecated: [],
  hidden: ['main'],
  packages: {},
};

const names = PACKAGES.map(({ name }) => name);

const serverLines = [
  { id: 'v0', tag: 'ui-router-server@0.9.0', status: 'frozen' },
  { id: 'v1', tag: 'ui-router-server@1.2.0', status: 'current' },
] as const;

/** The manifest with these lines for `ui-router-server`. */
const withLines = (lines: readonly object[], name = 'ui-router-server') =>
  v.parse(VersionManifestSchema, { ...manifest, packages: { [name]: lines } });

describe('the bundled manifest', () => {
  it('parses and names the root as current', () => {
    assert.equal(BUNDLED_MANIFEST.current.path, '/');
  });

  it('lists 1.x, the one frozen snapshot', () => {
    assert.deepEqual(
      BUNDLED_MANIFEST.others.map(({ id }) => id),
      ['v1'],
    );
  });

  it('lists only sound package lines', () => {
    assert.deepEqual(lineProblems(BUNDLED_MANIFEST, names), []);
  });
});

describe('VersionManifest', () => {
  it('accepts a manifest', () => {
    assert.ok(v.is(VersionManifestSchema, manifest));
  });

  it('rejects a path without its slashes', () => {
    assert.ok(
      !v.is(VersionManifestSchema, {
        ...manifest,
        others: [{ ...v1, path: 'v1' }],
      }),
    );
  });

  it('rejects anything else', () => {
    for (const raw of [null, 'versions', {}, { ...manifest, hidden: 'main' }]) {
      assert.ok(!v.is(VersionManifestSchema, raw));
    }
  });

  it('reads a manifest from before the package lines as listing none', () => {
    const { packages: _, ...earlier } = manifest;

    assert.deepEqual(v.parse(VersionManifestSchema, earlier).packages, {});
  });

  it('accepts package lines and the tag of a site-wide version', () => {
    const result = v.safeParse(VersionManifestSchema, {
      ...manifest,
      others: [{ ...v1, tag: 'lit-ui-router-ssr@0.11.1' }],
      packages: { 'ui-router-server': serverLines },
    });

    assert.ok(result.success);
    assert.deepEqual(result.output.packages, {
      'ui-router-server': serverLines,
    });
    assert.equal(result.output.others[0]?.tag, 'lit-ui-router-ssr@0.11.1');
  });

  it('rejects a line without a major id, a tag or a known status', () => {
    for (const line of [
      { ...serverLines[0], id: '0.x' },
      { ...serverLines[0], id: 'v0.9' },
      { ...serverLines[0], tag: '' },
      { id: 'v0', status: 'frozen' },
      { ...serverLines[0], status: 'latest' },
    ]) {
      assert.ok(
        !v.is(VersionManifestSchema, {
          ...manifest,
          packages: { 'ui-router-server': [line] },
        }),
        JSON.stringify(line),
      );
    }
  });

  it('accepts fields a later schema adds, so a frozen build still reads the live manifest', () => {
    const later = {
      ...manifest,
      unreleased: true,
      others: [{ ...v1, released: '2026-11-01' }],
    };

    const result = v.safeParse(VersionManifestSchema, later);

    assert.ok(result.success);
    assert.deepEqual(result.output.others, [v1]);
  });
});

describe('versionOf', () => {
  it('matches the build base to a version path', () => {
    assert.equal(versionOf(manifest, '/'), latest);
    assert.equal(versionOf(manifest, '/v1/'), v1);
    assert.equal(versionOf(manifest, '/main/'), main);
  });

  it('is undefined for an unlisted base', () => {
    assert.equal(versionOf(manifest, '/v0/'), undefined);
  });
});

describe('packageLines', () => {
  it('sorts by major, newest first, and is empty for a package with no line', () => {
    const baked = withLines([
      serverLines[0],
      { id: 'v10', tag: 'ui-router-server@10.0.0', status: 'current' },
      { id: 'v2', tag: 'ui-router-server@2.0.0', status: 'frozen' },
    ]);

    assert.deepEqual(
      packageLines(baked, 'ui-router-server').map(({ id }) => id),
      ['v10', 'v2', 'v0'],
    );
    assert.deepEqual(packageLines(baked, 'lit-ui-router'), []);
    assert.deepEqual(packageLines(baked, 'constructor'), []);
  });
});

describe('lineProblems', () => {
  it('passes lines in either order', () => {
    assert.deepEqual(lineProblems(withLines(serverLines), names), []);
    assert.deepEqual(
      lineProblems(withLines([...serverLines].reverse()), names),
      [],
    );
  });

  it('names a package outside the catalog', () => {
    assert.deepEqual(lineProblems(withLines(serverLines, 'effect'), names), [
      'effect: not a catalog package',
    ]);
  });

  it("names a tag of another package or another major than the line's", () => {
    assert.deepEqual(
      lineProblems(
        withLines([
          { id: 'v0', tag: 'ui-router-server@1.0.0', status: 'frozen' },
          { id: 'v1', tag: 'lit-ui-router@1.9.0', status: 'current' },
        ]),
        names,
      ),
      [
        'ui-router-server v1: tag lit-ui-router@1.9.0 is not ui-router-server@1.x',
        'ui-router-server v0: tag ui-router-server@1.0.0 is not ui-router-server@0.x',
      ],
    );
  });

  it('names a major listed twice', () => {
    assert.deepEqual(
      lineProblems(
        withLines([
          { id: 'v0', tag: 'ui-router-server@0.9.0', status: 'current' },
          { id: 'v0', tag: 'ui-router-server@0.8.0', status: 'frozen' },
        ]),
        names,
      ),
      ['ui-router-server v0: listed twice'],
    );
  });

  it('names a newest line that is frozen and an older one that is current', () => {
    assert.deepEqual(
      lineProblems(
        withLines([
          { ...serverLines[0], status: 'current' },
          { ...serverLines[1], status: 'frozen' },
        ]),
        names,
      ),
      [
        'ui-router-server v1: the newest line is not current',
        'ui-router-server v0: an older line is current',
      ],
    );
  });

  it('names a package listed with no line', () => {
    assert.deepEqual(lineProblems(withLines([]), names), [
      'ui-router-server: lists no line',
    ]);
  });
});

describe('menuVersions', () => {
  it('lists the current version, then the visible others in order', () => {
    assert.deepEqual(menuVersions(manifest), [latest, v1]);
  });

  it('keeps deprecated versions', () => {
    assert.deepEqual(menuVersions({ ...manifest, deprecated: ['v1'] }), [
      latest,
      v1,
    ]);
  });
});

describe('pagePath', () => {
  it('drops the extension and index pages, as cleanUrls does', () => {
    assert.equal(pagePath('index.md'), '');
    assert.equal(pagePath('guides/index.md'), 'guides/');
    assert.equal(pagePath('guides/route-guards.md'), 'guides/route-guards');
    assert.equal(pagePath('api/reference/index.md'), 'api/reference/');
  });

  it('keeps a page whose name only ends in index', () => {
    assert.equal(pagePath('guides/reindex.md'), 'guides/reindex');
  });
});

describe('sameVersionPage', () => {
  it('prefixes the target version path', () => {
    assert.equal(
      sameVersionPage(v1, 'guides/route-guards.md', false),
      '/v1/guides/route-guards',
    );
    assert.equal(
      sameVersionPage(latest, 'guides/route-guards.md', false),
      '/guides/route-guards',
    );
  });

  it("sends the 404 page to the target version's home", () => {
    assert.equal(sameVersionPage(v1, '404.md', true), '/v1/');
  });
});

describe('bannerKind', () => {
  it('shows nothing on the current version or an unlisted build', () => {
    assert.equal(bannerKind(manifest, latest), 'none');
    assert.equal(bannerKind(manifest, undefined), 'none');
  });

  it('marks older, deprecated and hidden versions', () => {
    assert.equal(bannerKind(manifest, v1), 'older');
    assert.equal(
      bannerKind({ ...manifest, deprecated: ['v1'] }, v1),
      'deprecated',
    );
    assert.equal(bannerKind(manifest, main), 'unreleased');
  });
});
