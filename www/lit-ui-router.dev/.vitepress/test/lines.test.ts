import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  homeOf,
  lineLabel,
  locate,
  pageAt,
  versionMenu,
  type LineTarget,
} from '../lines.ts';
import type { VersionManifest } from '../versions.ts';

const v1 = { id: 'v1', label: '1.x', path: '/v1/' };

const manifest: VersionManifest = {
  current: { id: 'latest', label: 'latest', path: '/' },
  others: [v1],
  deprecated: [],
  hidden: [],
  packages: {
    'ui-router-server': [
      { id: 'v0', tag: 'ui-router-server@0.9.0', status: 'frozen' },
      { id: 'v1', tag: 'ui-router-server@1.2.0', status: 'current' },
    ],
  },
};

const main: LineTarget = { kind: 'main' };

const site: LineTarget = { kind: 'site', line: v1 };

const server = (line: string): LineTarget => ({
  kind: 'package',
  package: 'ui-router-server',
  line,
});

/** The same page at a target, from a URL path. */
const at = (path: string, target: LineTarget): string | undefined =>
  pageAt(locate(manifest, path), target);

/** A menu's entries as label and link pairs. */
const links = (path: string, from = manifest, notFound = false): string[][] =>
  versionMenu(from, path, notFound).entries.map(({ label, href }) => [
    label,
    href,
  ]);

describe('locate', () => {
  it('finds the package of a package page and of its reference', () => {
    assert.deepEqual(locate(manifest, '/packages/ui-router-server'), {
      unversioned: false,
      package: 'ui-router-server',
      page: 'packages/ui-router-server',
    });
    assert.deepEqual(
      locate(manifest, '/reference/ui-router-server/vite/functions/plugin'),
      {
        unversioned: false,
        package: 'ui-router-server',
        page: 'reference/ui-router-server/vite/functions/plugin',
      },
    );
  });

  it('reads the line out of a line URL and keeps the unversioned page', () => {
    assert.deepEqual(locate(manifest, '/packages/ui-router-server/v0'), {
      unversioned: false,
      package: 'ui-router-server',
      packageLine: 'v0',
      page: 'packages/ui-router-server',
    });
    assert.deepEqual(locate(manifest, '/reference/ui-router-server/v0/vite/'), {
      unversioned: false,
      package: 'ui-router-server',
      packageLine: 'v0',
      page: 'reference/ui-router-server/vite/',
    });
    assert.deepEqual(locate(manifest, '/reference/ui-router-server/v12/'), {
      unversioned: false,
      package: 'ui-router-server',
      packageLine: 'v12',
      page: 'reference/ui-router-server/',
    });
  });

  it('strips a site-wide line prefix', () => {
    assert.deepEqual(locate(manifest, '/v1/guides/route-guards'), {
      unversioned: false,
      siteLine: v1,
      page: 'guides/route-guards',
    });
    assert.deepEqual(locate(manifest, '/v1/'), {
      unversioned: false,
      siteLine: v1,
      page: '',
    });
    assert.deepEqual(locate(manifest, '/v1/packages/ui-router-server'), {
      unversioned: false,
      siteLine: v1,
      package: 'ui-router-server',
      page: 'packages/ui-router-server',
    });
  });

  it('gives no package to the package index, a hub page or a name outside the catalog', () => {
    for (const path of [
      '/packages/',
      '/packages/effect',
      '/reference/',
      '/reference/not-a-package/',
      '/guides/route-guards',
    ]) {
      assert.equal(locate(manifest, path).package, undefined, path);
    }
  });

  it('marks the site page, the release pages and their stubs unversioned', () => {
    for (const path of [
      '/site/',
      '/releases',
      '/releases/',
      '/releases/ui-router-server/',
      '/package-releases/ui-router-server',
      '/v1/site/',
    ]) {
      assert.ok(locate(manifest, path).unversioned, path);
    }

    assert.ok(!locate(manifest, '/sitemap').unversioned);
  });
});

describe('pageAt', () => {
  it('moves a package page onto a line and back', () => {
    assert.equal(
      at('/packages/ui-router-server', server('v0')),
      '/packages/ui-router-server/v0',
    );
    assert.equal(
      at('/packages/ui-router-server/v0', server('v1')),
      '/packages/ui-router-server/v1',
    );
    assert.equal(
      at('/packages/ui-router-server/v0', main),
      '/packages/ui-router-server',
    );
  });

  it('moves a reference index', () => {
    assert.equal(
      at('/reference/ui-router-server/', server('v0')),
      '/reference/ui-router-server/v0/',
    );
    assert.equal(
      at('/reference/ui-router-server/v0/', main),
      '/reference/ui-router-server/',
    );
  });

  it('moves a reference member page', () => {
    assert.equal(
      at('/reference/ui-router-server/index/functions/match', server('v0')),
      '/reference/ui-router-server/v0/index/functions/match',
    );
    assert.equal(
      at('/reference/ui-router-server/v0/index/functions/match', server('v1')),
      '/reference/ui-router-server/v1/index/functions/match',
    );
  });

  it('moves an entry-point reference, keeping the line ahead of the entry point', () => {
    assert.equal(
      at('/reference/ui-router-server/vite/', server('v0')),
      '/reference/ui-router-server/v0/vite/',
    );
    assert.equal(
      at('/reference/ui-router-server/v0/vite/interfaces/Options', main),
      '/reference/ui-router-server/vite/interfaces/Options',
    );
  });

  it('moves a guide between the unversioned docs and a site-wide line', () => {
    assert.equal(at('/guides/route-guards', site), '/v1/guides/route-guards');
    assert.equal(at('/v1/guides/route-guards', main), '/guides/route-guards');
    assert.equal(at('/', site), '/v1/');
  });

  it('has no package line for a guide or for another package', () => {
    assert.equal(at('/guides/route-guards', server('v0')), undefined);
    assert.equal(at('/packages/lit-ui-router', server('v0')), undefined);
  });

  it('has no version of a releases page', () => {
    for (const target of [main, site, server('v0')]) {
      assert.equal(at('/releases/ui-router-server/', target), undefined);
    }
  });
});

describe('homeOf', () => {
  it("is the line's package page, the site-wide line's home, or the unversioned package page", () => {
    const guide = locate(manifest, '/guides/route-guards');
    const page = locate(manifest, '/reference/ui-router-server/v0/vite/');

    assert.equal(homeOf(guide, server('v0')), '/packages/ui-router-server/v0');
    assert.equal(homeOf(guide, site), '/v1/');
    assert.equal(homeOf(guide, main), '/');
    assert.equal(homeOf(page, main), '/packages/ui-router-server');
  });
});

describe('lineLabel', () => {
  it('names a line by its major', () => {
    assert.equal(lineLabel('v0'), '0.x');
    assert.equal(lineLabel('v12'), '12.x');
  });
});

describe('versionMenu', () => {
  it("lists a package's lines, newest first, after the unversioned entry", () => {
    assert.deepEqual(links('/reference/ui-router-server/vite/'), [
      ['latest', '/reference/ui-router-server/vite/'],
      ['1.x', '/reference/ui-router-server/v1/vite/'],
      ['0.x', '/reference/ui-router-server/v0/vite/'],
    ]);
  });

  it('labels the menu with the line the page is on', () => {
    assert.equal(
      versionMenu(manifest, '/packages/ui-router-server').label,
      'latest',
    );
    assert.equal(
      versionMenu(manifest, '/packages/ui-router-server/v0').label,
      '0.x',
    );
    assert.equal(versionMenu(manifest, '/v1/introduction').label, '1.x');
  });

  it("labels a line the manifest doesn't list yet", () => {
    assert.equal(
      versionMenu(manifest, '/packages/ui-router-server/v2').label,
      '2.x',
    );
  });

  it("falls back to the line's package page", () => {
    assert.deepEqual(
      versionMenu(manifest, '/reference/ui-router-server/vite/').entries.map(
        ({ fallback }) => fallback,
      ),
      [
        '/packages/ui-router-server',
        '/packages/ui-router-server/v1',
        '/packages/ui-router-server/v0',
      ],
    );
  });

  it('leaves a package with no line only the unversioned entry', () => {
    assert.deepEqual(links('/packages/ui-router-mobx'), [
      ['latest', '/packages/ui-router-mobx'],
    ]);
  });

  it("keeps the site-wide lines on the router's own pages", () => {
    assert.deepEqual(links('/packages/lit-ui-router'), [
      ['latest', '/packages/lit-ui-router'],
      ['1.x', '/v1/packages/lit-ui-router'],
    ]);
  });

  it("replaces a site-wide line with the router's own line of that major", () => {
    const baked: VersionManifest = {
      ...manifest,
      packages: {
        'lit-ui-router': [
          { id: 'v1', tag: 'lit-ui-router@1.9.0', status: 'current' },
        ],
      },
    };

    assert.deepEqual(links('/reference/lit-ui-router/', baked), [
      ['latest', '/reference/lit-ui-router/'],
      ['1.x', '/reference/lit-ui-router/v1/'],
    ]);
  });

  it('lists the site-wide lines on guides, the tutorial and the introduction', () => {
    assert.deepEqual(links('/guides/route-guards'), [
      ['latest', '/guides/route-guards'],
      ['1.x', '/v1/guides/route-guards'],
    ]);
    assert.deepEqual(links('/tutorial/'), [
      ['latest', '/tutorial/'],
      ['1.x', '/v1/tutorial/'],
    ]);
    assert.deepEqual(links('/v1/introduction'), [
      ['latest', '/introduction'],
      ['1.x', '/v1/introduction'],
    ]);
  });

  it('leaves out a hidden site-wide line', () => {
    assert.deepEqual(links('/introduction', { ...manifest, hidden: ['v1'] }), [
      ['latest', '/introduction'],
    ]);
  });

  it("keeps a site-wide line's own entry on its package pages", () => {
    assert.deepEqual(links('/v1/packages/ui-router-mobx'), [
      ['latest', '/packages/ui-router-mobx'],
      ['1.x', '/v1/packages/ui-router-mobx'],
    ]);
  });

  it('lists nothing on an unversioned page', () => {
    assert.deepEqual(links('/site/'), []);
    assert.deepEqual(links('/package-releases/ui-router-server'), []);
    assert.deepEqual(links('/releases/ui-router-server/'), []);
  });

  it('sends every entry of a missing page to its fallback', () => {
    assert.deepEqual(links('/', manifest, true), [
      ['latest', '/'],
      ['1.x', '/v1/'],
    ]);
    assert.deepEqual(
      links('/reference/ui-router-server/gone', manifest, true),
      [
        ['latest', '/packages/ui-router-server'],
        ['1.x', '/packages/ui-router-server/v1'],
        ['0.x', '/packages/ui-router-server/v0'],
      ],
    );
  });
});
