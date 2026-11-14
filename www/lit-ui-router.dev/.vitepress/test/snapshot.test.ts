import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { getAllByRole, getByRole } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';

import { REDIRECTS } from '../../catalog/redirects.ts';
import {
  allRedirectLines,
  isDynamic,
  redirectLines,
  redirectsLine,
  SNAPSHOT_PREFIX,
  snapshotRedirectProblems,
  snapshotRedirects,
  tableProblems,
} from '../redirects.ts';
import {
  canonicalPath,
  copySnapshots,
  hasSnapshotTag,
  htmlPath,
  indexProblems,
  snapshotLlmsTxt,
  snapshotPages,
  SNAPSHOTS_DIR,
  unversionWorkerLinks,
  versionExampleLinks,
  WORKER_MOUNTS,
  withCanonical,
} from '../snapshot.ts';
import { surfaceOf } from '../surfaces.ts';
import { BUNDLED_MANIFEST, SITE_ORIGIN } from '../versions.ts';

/** Parses a built page for `check`, then closes its happy-dom window: 400 open windows exhaust the heap. */
async function withPage(file: string, check: (doc: Document) => void) {
  const doc = parseHtml(readFileSync(file, 'utf8'));

  try {
    check(doc);
  } finally {
    // SAFETY: parseHtml's document belongs to a happy-dom window, whose happyDOM handle lib.dom doesn't declare.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- happy-dom declares its DOM apart from lib.dom
    const window = doc.defaultView as unknown as {
      happyDOM: { close: () => Promise<void> };
    };

    await window.happyDOM.close();
  }
}

/** A temporary build output holding these files. */
function outDir(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-'));

  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), '');
  }

  return dir;
}

describe('the version manifest', () => {
  it('gives every other version a snapshot tag and a path from its id', () => {
    for (const { id, path } of BUNDLED_MANIFEST.others) {
      assert.ok(hasSnapshotTag(id), id);
      assert.equal(path, `/${id}/`);
    }
  });

  it('serves 1.x at the snapshot prefix', () => {
    assert.deepEqual(
      BUNDLED_MANIFEST.others.find(({ id }) => id === 'v1'),
      { id: 'v1', label: '1.x', path: SNAPSHOT_PREFIX },
    );
  });

  it('keeps each version path out of the sitemap, llms.txt and search', () => {
    for (const { path } of BUNDLED_MANIFEST.others) {
      for (const url of [path, `${path}guides/route-guards`]) {
        const surface = surfaceOf(url);

        assert.equal(surface.renderer, 'static', url);
        assert.equal(surface.sitemap, false, url);
        assert.equal(surface.llms, false, url);
        assert.equal(surface.search, false, url);
      }
    }
  });
});

describe('unversionWorkerLinks', () => {
  it('sends links into the worker mounts to the root, in attributes and string literals', () => {
    assert.equal(
      unversionWorkerLinks(
        '<a href="/v1/releases/" target="_self">R</a><a href="/v1/app-mobx">M</a>',
        '/v1/',
      ),
      '<a href="/releases/" target="_self">R</a><a href="/app-mobx">M</a>',
    );
    assert.equal(
      unversionWorkerLinks('h("a",{href:"/v1/app"}),`/v1/gh/x`', '/v1/'),
      'h("a",{href:"/app"}),`/gh/x`',
    );
    assert.equal(
      unversionWorkerLinks('\\"/v1/releases\\"', '/v1/'),
      '\\"/releases\\"',
    );
  });

  it('leaves the snapshot pages and lookalike paths alone', () => {
    const text =
      '<a href="/v1/guides/">G</a><a href="/v1/applications">A</a><a href="/v1/package-releases/x">S</a>';

    assert.equal(unversionWorkerLinks(text, '/v1/'), text);
  });

  it('covers every worker mount', () => {
    assert.ok(WORKER_MOUNTS.includes('/releases'));
    assert.ok(WORKER_MOUNTS.includes('/app'));
    assert.ok(WORKER_MOUNTS.every((mount) => !mount.includes('*')));
  });
});

describe('versionExampleLinks', () => {
  it('moves the built examples under the base and leaves other paths', () => {
    assert.equal(
      versionExampleLinks(
        '<iframe src="/examples/helloworld/"></iframe><a href="/v1/examples/">E</a><script src="/examples/helloworld/assets/a.js">',
        '/v1/',
        ['helloworld'],
      ),
      '<iframe src="/v1/examples/helloworld/"></iframe><a href="/v1/examples/">E</a><script src="/v1/examples/helloworld/assets/a.js">',
    );
  });
});

describe('snapshotLlmsTxt', () => {
  it('moves page URLs under the base, keeps worker URLs at the root, and names the latest', () => {
    const text = `# Lit UI Router\n\n> Routing\n\n- [Guide](${SITE_ORIGIN}/guides/a.md): a\n- [Releases](${SITE_ORIGIN}/releases/): r\n`;

    assert.equal(
      snapshotLlmsTxt(text, '/v1/', '1.x'),
      `# Lit UI Router\n\n> These are the 1.x docs, kept as they were at their last release. The latest docs are at ${SITE_ORIGIN}/llms.txt.\n\n> Routing\n\n- [Guide](${SITE_ORIGIN}/v1/guides/a.md): a\n- [Releases](${SITE_ORIGIN}/releases/): r\n`,
    );
  });
});

describe('canonicalPath', () => {
  const dir = outDir(['index.html', 'guides/a.html', 'guides/index.html']);

  const moved = [{ from: '/guides/old', to: '/guides/a', status: 301 }];

  it('keeps a page the main build serves, follows a moved one, and falls back to the home page', () => {
    assert.equal(canonicalPath('/guides/a', dir, moved), '/guides/a');
    assert.equal(canonicalPath('/guides/', dir, moved), '/guides/');
    assert.equal(canonicalPath('/guides/old', dir, moved), '/guides/a');
    assert.equal(canonicalPath('/guides/gone', dir, moved), '/');
  });

  it('maps page files to their clean URLs', () => {
    assert.equal(htmlPath('index.html'), '/');
    assert.equal(htmlPath('guides/index.html'), '/guides/');
    assert.equal(htmlPath('guides/a.html'), '/guides/a');
  });
});

describe('withCanonical', () => {
  it('replaces an earlier canonical link with one', () => {
    const doc = parseHtml(
      withCanonical(
        withCanonical(
          '<html><head><title>t</title></head><body></body></html>',
          'https://a/',
        ),
        'https://b/',
      ),
    );

    // Head metadata has no role, so a selector is the only lookup.
    const links = [...doc.querySelectorAll('link[rel="canonical"]')];

    assert.deepEqual(
      links.map((link) => link.getAttribute('href')),
      ['https://b/'],
    );
  });
});

describe('snapshot redirects', () => {
  it('send each worker mount under the prefix to the mount and pass the table rules', () => {
    const rules = snapshotRedirects();

    assert.ok(rules.length > 0);

    for (const { from, to } of rules) {
      assert.ok(from.startsWith(SNAPSHOT_PREFIX), from);
      assert.equal(surfaceOf(to.replace(':splat', 'x')).renderer, 'worker', to);
    }

    assert.deepEqual(tableProblems(allRedirectLines()), []);
  });

  it('still refuse a table rule under the prefix', () => {
    assert.deepEqual(
      tableProblems([{ from: '/v1/guide', to: '/guide', status: 301 }]),
      ['/v1/guide /guide 301: source under /v1/'],
    );
  });

  it('flag a built file under a source', () => {
    const dir = outDir(['v1/releases/index.html', 'v1/guides/a.html']);

    assert.deepEqual(snapshotRedirectProblems(snapshotRedirects(), dir), [
      '/v1/releases /releases 301: a built file sits under the source',
      '/v1/releases/* /releases/:splat 301: a built file sits under the source',
    ]);
  });

  it('come after the table, statics ahead of dynamic rules', () => {
    const table = redirectLines(REDIRECTS).map(redirectsLine);
    const lines = allRedirectLines();
    const firstDynamic = lines.findIndex(isDynamic);

    assert.deepEqual(
      lines.map(redirectsLine).filter((line) => table.includes(line)),
      table,
    );
    assert.ok(lines.slice(firstDynamic).every(isDynamic));
  });
});

const v1 = join(SNAPSHOTS_DIR, 'v1');

describe(
  'the 1.x snapshot',
  {
    skip:
      !existsSync(join(v1, 'index.html')) &&
      'no snapshots/v1: run scripts/docs-snapshot.ts',
  },
  () => {
    it('shows the banner on every prerendered page, linking the same page in latest', async () => {
      // VitePress renders its 404 page on the client only.
      const pages = (await snapshotPages(v1)).filter(
        (page) => page !== '404.html',
      );

      assert.ok(pages.length > 400, String(pages.length));

      for (const page of pages) {
        await withPage(join(v1, page), (doc) => {
          const banner = getByRole(doc.body, 'note', { name: 'Docs version' });

          assert.equal(
            getByRole(banner, 'link', { name: 'Go to latest' }).getAttribute(
              'href',
            ),
            htmlPath(page),
            page,
          );
        });
      }
    });

    it('links the worker mounts at the root', async () => {
      let hrefs: string[] = [];

      await withPage(join(v1, 'guides/unmatched-urls.html'), (doc) => {
        hrefs = getAllByRole(doc.body, 'link').map(
          (link) => link.getAttribute('href') ?? '',
        );
      });

      assert.ok(hrefs.includes('/releases/'));
      assert.ok(hrefs.includes('/app'));
      assert.deepEqual(
        hrefs.filter((href) =>
          WORKER_MOUNTS.some((mount) =>
            href.startsWith(`${SNAPSHOT_PREFIX}${mount.slice(1)}`),
          ),
        ),
        [],
      );
    });

    it('carries its own llms.txt with its pages under the prefix', () => {
      const text = readFileSync(join(v1, 'llms.txt'), 'utf8');

      assert.match(text, /These are the 1\.x docs/);
      assert.ok(text.includes(`${SITE_ORIGIN}/v1/guides/`));
      assert.ok(!text.includes(`${SITE_ORIGIN}/guides/`));
    });
  },
);

describe('indexProblems', () => {
  it('flags a main index that lists a snapshot URL', async () => {
    const dir = outDir([]);

    writeFileSync(
      join(dir, 'sitemap-pages.xml'),
      `<loc>${SITE_ORIGIN}/v1/guides/a</loc>`,
    );
    writeFileSync(join(dir, 'llms.txt'), `- [A](${SITE_ORIGIN}/guides/a.md)`);
    writeFileSync(join(dir, 'llms-full.txt'), '');

    assert.deepEqual(await indexProblems(BUNDLED_MANIFEST, dir), [
      `sitemap-pages.xml: lists ${SITE_ORIGIN}/v1/`,
    ]);
  });
});

describe('copySnapshots', () => {
  it('fails the build for a listed version with no snapshot', async () => {
    const manifest = {
      ...BUNDLED_MANIFEST,
      others: [{ id: 'v0', label: '0.x', path: '/v0/' }],
    };

    await assert.rejects(copySnapshots(manifest, outDir([]), []), {
      message:
        /lists v0 at \/v0\/, but .*snapshots\/v0 holds no snapshot: run scripts\/docs-snapshot\.ts v0/,
    });
  });
});
