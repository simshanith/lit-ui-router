import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as v from 'valibot';

import {
  BUNDLED_MANIFEST,
  bannerKind,
  menuVersions,
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
};

describe('the bundled manifest', () => {
  it('parses and names the root as current', () => {
    assert.equal(BUNDLED_MANIFEST.current.path, '/');
  });

  it('lists no version the site does not serve yet', () => {
    assert.deepEqual(BUNDLED_MANIFEST.others, []);
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
