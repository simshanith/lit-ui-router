import assert from 'node:assert/strict';
import {
  existsSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';

import { getAllByRole, getByRole } from '@testing-library/dom';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';

import { REDIRECTS } from '../../catalog/redirects.ts';
import { GENERATED_PAGES } from '../page-meta.ts';
import {
  matchRedirect,
  redirectLines,
  SNAPSHOT_PREFIXES,
} from '../redirects.ts';
import {
  canonicalOf,
  canonicalPath,
  canonicalProblems,
  hasSnapshotTag,
  htmlPath,
  indexProblems,
  isLiveSnapshot,
  readSnapshotManifest,
  snapshotCanonicals,
  snapshotDigest,
  snapshotHeaders,
  snapshotLlmsTxt,
  snapshotNote,
  snapshotPackage,
  snapshotPages,
  snapshotRedirects,
  SNAPSHOT_TAGS,
  unversionWorkerLinks,
  versionExampleLinks,
  withCanonical,
  WORKER_MOUNTS,
  writeSnapshotRules,
} from '../snapshot.ts';
import { pageUrl, surfaceOf } from '../surfaces.ts';
import { withPage } from './with-page.ts';
import { BUNDLED_MANIFEST, SITE_ORIGIN } from '../versions.ts';

const site = join(import.meta.dirname, '../..');

/** The frozen 1.x snapshot's prefix. */
const SNAPSHOT_PREFIX = '/v1/';

/** A temporary build output holding these files. */
function outDir(files: Record<string, string> | string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'snapshot-'));

  const entries = Array.isArray(files)
    ? files.map((file) => [file, ''] as const)
    : Object.entries(files);

  for (const [file, text] of entries) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), text);
  }

  return dir;
}

describe('the version manifest', () => {
  it('builds every other version from a snapshot tag or from the checkout, at a path from its id', () => {
    for (const { id, path } of BUNDLED_MANIFEST.others) {
      assert.notEqual(hasSnapshotTag(id), isLiveSnapshot(id), id);
      assert.equal(path, `/${id}/`);
    }
  });

  it('hides the versions built from the checkout, and no frozen one', () => {
    assert.deepEqual(
      BUNDLED_MANIFEST.hidden,
      BUNDLED_MANIFEST.others.map(({ id }) => id).filter(isLiveSnapshot),
    );
  });

  it('keeps redirects out of every version prefix', () => {
    assert.deepEqual(SNAPSHOT_PREFIXES, ['/main/', '/v1/']);
  });

  it('serves 1.x at the snapshot prefix', () => {
    assert.deepEqual(
      BUNDLED_MANIFEST.others.find(({ id }) => id === 'v1'),
      { id: 'v1', label: '1.x', path: SNAPSHOT_PREFIX },
    );
  });

  it('hands each version path to the worker, out of the sitemap, llms.txt and search', () => {
    for (const { path } of BUNDLED_MANIFEST.others) {
      for (const url of [path.slice(0, -1), path, `${path}guides/a`]) {
        const surface = surfaceOf(url);

        assert.equal(surface.id, `snapshot-${path.slice(1, -1)}`, url);
        assert.equal(surface.renderer, 'worker', url);
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

  it('covers every worker mount but the snapshots', () => {
    assert.ok(WORKER_MOUNTS.includes('/releases'));
    assert.ok(WORKER_MOUNTS.includes('/app'));
    assert.ok(!WORKER_MOUNTS.includes('/v1'));
    assert.ok(!WORKER_MOUNTS.includes('/main'));
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
      snapshotLlmsTxt(text, '/v1/', snapshotNote('1.x', 'older')),
      `# Lit UI Router\n\n> These are the 1.x docs, kept as they were at their last release. The latest docs are at ${SITE_ORIGIN}/llms.txt.\n\n> Routing\n\n- [Guide](${SITE_ORIGIN}/v1/guides/a.md): a\n- [Releases](${SITE_ORIGIN}/releases/): r\n`,
    );
  });
});

describe('snapshotLlmsTxt for the unreleased docs', () => {
  it('names the released docs, and leaves a URL the build already put under the base', () => {
    const text = `# Lit UI Router\n\n> Routing\n\nurl: ${SITE_ORIGIN}/main/guides/a.md\n- [Guide](${SITE_ORIGIN}/guides/a.md): a\n- [Maintenance](${SITE_ORIGIN}/maintenance.md): m\n`;

    assert.equal(
      snapshotLlmsTxt(text, '/main/', snapshotNote('main', 'unreleased')),
      `# Lit UI Router\n\n> These are the unreleased docs, built from main. The released docs are at ${SITE_ORIGIN}/llms.txt.\n\n> Routing\n\nurl: ${SITE_ORIGIN}/main/guides/a.md\n- [Guide](${SITE_ORIGIN}/main/guides/a.md): a\n- [Maintenance](${SITE_ORIGIN}/main/maintenance.md): m\n`,
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
  it('replaces an earlier canonical link with one, which canonicalOf reads back', () => {
    const html = withCanonical(
      withCanonical(
        '<html><head><title>t</title></head><body></body></html>',
        `${SITE_ORIGIN}/a`,
      ),
      `${SITE_ORIGIN}/guides/b`,
    );

    const doc = parseHtml(html);

    // Head metadata has no role, so a selector is the only lookup.
    const links = [...doc.querySelectorAll('link[rel="canonical"]')];

    assert.deepEqual(
      links.map((link) => link.getAttribute('href')),
      [`${SITE_ORIGIN}/guides/b`],
    );
    assert.equal(canonicalOf(html), '/guides/b');
    assert.equal(canonicalOf('<html><head></head></html>'), undefined);
  });
});

describe('snapshotCanonicals', () => {
  const page = (href?: string): string =>
    `<html><head><meta name="generator" content="VitePress 2">${href ? `<link rel="canonical" href="${SITE_ORIGIN}${href}">` : ''}</head></html>`;

  it('maps each page under the base to its canonical target, and lists the pages with none', async () => {
    const dir = outDir({
      'index.html': page('/'),
      'guides/a.html': page('/guides/b'),
      'guides/bare.html': page(),
      '404.html': page(),
      'examples/x/index.html': '<html></html>',
    });

    assert.deepEqual(await snapshotCanonicals(dir, '/main/'), {
      pages: { '/main/': '/', '/main/guides/a': '/guides/b' },
      missing: ['guides/bare.html'],
    });
  });
});

describe("the snapshot Worker's rules", () => {
  it('send each worker mount under the prefix to the mount, statics first', async () => {
    const rules = snapshotRedirects('/v1/');

    assert.ok(rules.length > 0);

    for (const { from, to } of rules) {
      assert.ok(from.startsWith(SNAPSHOT_PREFIX), from);
      assert.equal(surfaceOf(to.replace(':splat', 'x')).renderer, 'worker', to);
      assert.ok(!to.startsWith('/v1'), to);
    }

    const root = outDir([]);

    await writeSnapshotRules(root, '/v1/', '/*\n  A: b\n');

    const lines = readFileSync(join(root, '_redirects'), 'utf8')
      .trimEnd()
      .split('\n');

    assert.ok(!lines.some((line) => line.startsWith('/v1/main')));
    assert.ok(lines.includes('/v1/releases /releases 301'));
    assert.ok(lines.includes('/v1/releases/* /releases/:splat 301'));

    const firstDynamic = lines.findIndex((line) => line.includes('*'));

    assert.ok(lines.slice(firstDynamic).every((line) => line.includes('*')));
  });

  it('move the main headers under the prefix, Link targets included', () => {
    assert.equal(
      snapshotHeaders(
        '/*\n  X: y\n  Link: </llms.txt>; rel="describedby", </introduction>; rel="service-doc"\n\n/assets/*\n  ! Link\n',
        '/v1/',
      ),
      '/v1/*\n  X: y\n  Link: </v1/llms.txt>; rel="describedby", </v1/introduction>; rel="service-doc"\n\n/v1/assets/*\n  ! Link\n',
    );
  });
});

describe('snapshotDigest', () => {
  it('counts the files and bytes and hashes their sha256sum listing', () => {
    const root = outDir({ 'v1/index.html': 'abc', _headers: 'de' });

    assert.deepEqual(snapshotDigest(root), {
      files: 2,
      bytes: 5,
      // sha256sum of the listing of `printf de | sha256sum` and `printf abc | sha256sum`, by path
      sha256:
        '7972389e97fa1697e4de43d07a591fccf05ac95473d1789712ac8b6a2fcf9199',
    });
  });
});

describe('canonicalProblems', () => {
  it('flags a target the main build neither serves nor redirects', () => {
    const dir = outDir(['guides/a.html']);

    const pages = {
      '/v1/guides/a': '/guides/a',
      '/v1/guides/old': '/guides/old',
      '/v1/guides/gone': '/guides/gone',
    };

    assert.deepEqual(
      canonicalProblems(pages, dir, [
        { from: '/guides/old', to: '/guides/a', status: 301 },
      ]),
      [
        '/v1/guides/gone: its canonical /guides/gone is neither served nor redirected',
      ],
    );
  });
});

describe('the committed 1.x manifest', () => {
  const manifest = readSnapshotManifest('v1');

  it('names the tag the recipe builds from and lists every page under the prefix', () => {
    assert.equal(manifest.tag, SNAPSHOT_TAGS.v1);

    const pages = Object.entries(manifest.pages);

    assert.ok(pages.length > 400, String(pages.length));

    for (const [page, target] of pages) {
      assert.ok(page.startsWith(SNAPSHOT_PREFIX), page);
      assert.ok(target.startsWith('/') && !target.startsWith('/v1/'), target);
    }
  });

  // The build checks every target against its output; generated pages exist only there.
  it('points every hand-written canonical at a page or a redirect', () => {
    const sources = new Set(
      globSync('**/*.md', {
        cwd: site,
        exclude: ['node_modules/**', 'dist/**', ...GENERATED_PAGES],
      }).map(pageUrl),
    );

    const generated = GENERATED_PAGES.map(
      (glob) => `/${glob.slice(0, glob.indexOf('*'))}`,
    );

    const redirects = redirectLines(REDIRECTS);

    const dead = Object.entries(manifest.pages).filter(
      ([, target]) =>
        !sources.has(target) &&
        !generated.some((prefix) => target.startsWith(prefix)) &&
        !matchRedirect(redirects, target),
    );

    assert.deepEqual(dead, []);
  });
});

const v1 = join(workspaceRoot, snapshotPackage('v1'), 'dist', 'v1');

describe(
  'the built 1.x snapshot',
  {
    skip:
      !existsSync(join(v1, 'index.html')) &&
      'no built snapshot: run scripts/docs-snapshot.ts',
  },
  () => {
    it('shows the banner on every prerendered page, linking the same page in latest, and its canonical', async () => {
      // VitePress renders its 404 page on the client only.
      const pages = (await snapshotPages(v1)).filter(
        (page) => page !== '404.html',
      );

      const manifest = readSnapshotManifest('v1');

      assert.ok(pages.length > 400, String(pages.length));

      for (const page of pages) {
        const html = readFileSync(join(v1, page), 'utf8');

        assert.equal(
          canonicalOf(html),
          manifest.pages[`/v1${htmlPath(page)}`],
          page,
        );

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
  it('flags a main index that lists a URL of another version, frozen or unreleased', async () => {
    const dir = outDir({
      'sitemap-pages.xml': `<loc>${SITE_ORIGIN}/v1/guides/a</loc>`,
      'llms.txt': `- [A](${SITE_ORIGIN}/guides/a.md)\n- [B](${SITE_ORIGIN}/main/guides/b.md)`,
      'llms-full.txt': `url: ${SITE_ORIGIN}/main/guides/b.md\nurl: ${SITE_ORIGIN}/maintenance.md`,
    });

    assert.deepEqual(await indexProblems(BUNDLED_MANIFEST, dir), [
      `sitemap-pages.xml: lists ${SITE_ORIGIN}/v1/`,
      `llms.txt: lists ${SITE_ORIGIN}/main/`,
      `llms-full.txt: lists ${SITE_ORIGIN}/main/`,
    ]);
  });
});
