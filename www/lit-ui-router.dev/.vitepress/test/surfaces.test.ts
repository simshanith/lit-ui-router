import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { type ParseError, parse } from 'jsonc-parser';
import { mounts } from 'sample-app-routes';
import * as v from 'valibot';

import { type Surface, SURFACES } from '../../catalog/surfaces.ts';
import { mounts as releaseMounts } from '../../worker/releases/routes.ts';
import { LLMS_RELEASES } from '../llms.ts';
import { RELEASES_PATH, releasesPath, STUB_DIR } from '../release-stubs.ts';
import {
  deadLinkIgnores,
  pageUrl,
  sourceGlob,
  surfaceIn,
  surfaceOf,
} from '../surfaces.ts';

const site = join(import.meta.dirname, '../..');

const WranglerAssets = v.object({
  assets: v.object({
    run_worker_first: v.optional(
      v.union([
        v.pipe(
          v.boolean(),
          v.transform((all) => (all ? ['/*'] : [])),
        ),
        v.array(v.string()),
      ]),
      [],
    ),
  }),
});

function runWorkerFirst(): string[] {
  const errors: ParseError[] = [];

  const config: unknown = parse(
    readFileSync(join(site, 'wrangler.jsonc'), 'utf8'),
    errors,
    { allowTrailingComma: true },
  );

  assert.deepEqual(errors, []);

  return v.parse(WranglerAssets, config).assets.run_worker_first;
}

const workerPaths = SURFACES.flatMap(({ renderer, paths }) =>
  renderer === 'worker' ? paths : [],
);

/** Paths inside a glob: its literal text, and its `*` standing for one and for two segments. */
const samples = (glob: string): string[] =>
  glob.includes('*')
    ? [glob.replaceAll('*', 'x'), glob.replaceAll('*', 'x/y')]
    : [glob];

const row = (id: string, ...paths: string[]): Surface => ({
  id,
  paths,
  renderer: 'vitepress',
  sitemap: true,
  llms: 'pages',
  search: true,
  deadLinks: 'check',
});

describe('catalog/surfaces.ts', () => {
  it('names each row once', () => {
    const ids = SURFACES.map(({ id }) => id);

    assert.equal(new Set(ids).size, ids.length);
  });

  it('lists exactly the run_worker_first patterns under its worker rows', () => {
    assert.deepEqual([...workerPaths].sort(), runWorkerFirst().sort());
  });

  it('gives every server-routed mount a worker row, with its bare path and its subpaths', () => {
    for (const mount of [
      ...Object.keys(mounts),
      ...Object.keys(releaseMounts),
    ]) {
      for (const path of [mount, `${mount}/*`]) {
        assert.ok(
          workerPaths.some((glob) => glob === path),
          path,
        );
      }
    }
  });

  it('owns the paths inside each glob by the row that lists it', () => {
    for (const { id, paths } of SURFACES) {
      for (const path of paths.flatMap(samples)) {
        assert.equal(surfaceOf(path).id, id, path);
      }
    }
  });

  it('renders every Markdown page in a row VitePress renders', () => {
    const shadowed = globSync('**/*.md', {
      cwd: site,
      exclude: ['node_modules/**', 'dist/**'],
    }).flatMap((source) => {
      const { id, renderer } = surfaceOf(pageUrl(source));

      return renderer === 'vitepress' || renderer === 'typedoc'
        ? []
        : [`${source}: ${id}`];
    });

    assert.deepEqual(shadowed, []);
  });

  it('puts the release stubs, the releases pages and the llms.txt Releases section where the settings expect', () => {
    assert.equal(surfaceOf(`/${STUB_DIR}/lit-ui-router`).id, 'release-stubs');
    assert.equal(surfaceOf(RELEASES_PATH).id, 'releases');
    assert.equal(surfaceOf(releasesPath('lit-ui-router')).id, 'releases');

    const linked = Array.from(
      LLMS_RELEASES.matchAll(/\]\(https:\/\/lit-ui-router\.dev(\/[^)]*)\)/g),
      ([, path = '']) => surfaceOf(path).id,
    );

    assert.deepEqual(
      [...new Set(linked)],
      SURFACES.filter(({ llms }) => llms === 'section').map(({ id }) => id),
    );
  });
});

describe('surfaceIn', () => {
  const table = [
    row('docs', '/*'),
    row('api', '/api/*'),
    row('page', '/api/page'),
    row('other', '/api/a/*'),
  ];

  it('gives a path to the matching glob with the longest text before its first *, and a bare glob to any wildcard', () => {
    assert.equal(surfaceIn(table, '/guide').id, 'docs');
    assert.equal(surfaceIn(table, '/api/a').id, 'api');
    assert.equal(surfaceIn(table, '/api/page').id, 'page');
    assert.equal(surfaceIn(table, '/api/a/x').id, 'other');
    assert.equal(surfaceIn(table, '/api/b/x').id, 'api');
  });

  it('throws when two rows tie on a path, or none matches', () => {
    assert.throws(
      () => surfaceIn([...table, row('twin', '/api/*/y')], '/api/b/y'),
      /\/api\/b\/y: claimed by api, twin/,
    );
    assert.throws(() => surfaceIn(table, 'guide'), /guide: no surface/);
  });
});

describe('pageUrl', () => {
  it('serves index pages at their folder and others without .md', () => {
    assert.equal(pageUrl('index.md'), '/');
    assert.equal(pageUrl('site/index.md'), '/site/');
    assert.equal(pageUrl('guides/route-guards.md'), '/guides/route-guards');
  });
});

describe('sourceGlob', () => {
  it('maps a folder to its index page and a trailing * to any depth', () => {
    assert.equal(sourceGlob('/site/'), 'site/index.md');
    assert.equal(sourceGlob('/package-releases/*'), 'package-releases/**');
    assert.equal(sourceGlob('/api/*/*'), 'api/*/**');
  });
});

describe('deadLinkIgnores', () => {
  const ignored = (url: string) =>
    deadLinkIgnores().some((ignore) =>
      ignore instanceof RegExp ? ignore.test(url) : url === ignore,
    );

  it('skips every link into an ignore row and the bare paths of an ignore-bare row', () => {
    assert.equal(ignored('/examples/helloworld/index'), true);
    assert.equal(ignored('/app'), true);
    assert.equal(ignored('/app/foo'), false);
    assert.equal(ignored('/app-hash'), false);
    assert.equal(ignored('/guides/route-guards'), false);
  });
});
