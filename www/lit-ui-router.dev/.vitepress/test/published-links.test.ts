import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { REDIRECTS } from '../../catalog/redirects.ts';
import {
  entryProblems,
  linkProblem,
  ORIGIN,
  packageLinks,
  type PublishedUrl,
  publishedUrls,
  siteUrls,
  unlistedLinks,
} from '../published-links.ts';
import { matchRedirect, spellings } from '../redirects.ts';

const problems = async (urls: readonly string[]) =>
  (await Promise.all(urls.map(linkProblem))).filter(Boolean);

describe('siteUrls', () => {
  it('finds site URLs in Markdown, HTML and JSON, without trailing punctuation', () => {
    assert.deepEqual(
      siteUrls(
        [
          '[Docs](https://lit-ui-router.dev/guides/x#y) and https://lit-ui-router.dev.',
          '<img src="https://lit-ui-router.dev/images/a.svg">',
          '"homepage": "https://lit-ui-router.dev/packages/x",',
          'https://atlas.lit-ui-router.dev https://lit-ui-router.devx',
        ].join('\n'),
      ),
      [
        'https://lit-ui-router.dev/guides/x#y',
        'https://lit-ui-router.dev',
        'https://lit-ui-router.dev/images/a.svg',
        'https://lit-ui-router.dev/packages/x',
      ],
    );
  });
});

describe('linkProblem', () => {
  it('passes a page and its heading, a public file, a worker route and a redirect source', async () => {
    assert.deepEqual(
      await problems([
        ORIGIN,
        `${ORIGIN}/guides/reactive-components#router-discovery`,
        `${ORIGIN}/images/lit-ui-router.svg`,
        `${ORIGIN}/gh/releases/lit-ui-router/latest`,
        `${ORIGIN}/packages/server`,
      ]),
      [],
    );
  });

  it('flags a missing page, a missing heading, a worker 404 and a redirect to nowhere', async () => {
    assert.deepEqual(
      await problems([
        `${ORIGIN}/guides/nowhere`,
        `${ORIGIN}/guides/reactive-components#nowhere`,
        `${ORIGIN}/gh/nowhere`,
        `${ORIGIN}/api/reference/nowhere`,
      ]),
      [
        `${ORIGIN}/guides/nowhere: no page source`,
        `${ORIGIN}/guides/reactive-components#nowhere: no heading #nowhere in guides/reactive-components.md`,
        `${ORIGIN}/gh/nowhere: the worker answers 404`,
        `${ORIGIN}/api/reference/nowhere -> /reference/lit-ui-router/nowhere: no generated reference page (docs:api writes them)`,
      ],
    );
  });
});

describe('unlistedLinks', () => {
  const entries: PublishedUrl[] = [
    { path: '/packages/server', packages: ['ui-router-server'] },
    {
      path: '/packages/server#trailing-slashes',
      packages: ['ui-router-server'],
    },
  ];

  it('needs an entry per fragment, not only the bare path', () => {
    assert.deepEqual(
      unlistedLinks(
        [
          { name: 'ui-router-server', url: `${ORIGIN}/packages/server` },
          {
            name: 'ui-router-server',
            url: `${ORIGIN}/packages/server#trailing-slashes`,
          },
          {
            name: 'ui-router-server',
            url: `${ORIGIN}/packages/server#response-states`,
          },
        ],
        entries,
      ),
      ['/packages/server#response-states ui-router-server'],
    );
  });
});

describe('entryProblems', () => {
  it('flags a fragment entry whose heading is gone, through its redirect', async () => {
    assert.deepEqual(
      await entryProblems([
        {
          path: '/packages/server#trailing-slashes',
          packages: ['ui-router-server'],
        },
        { path: '/packages/server#nowhere', packages: ['ui-router-server'] },
      ]),
      [
        `${ORIGIN}/packages/server#nowhere -> /packages/ui-router-server: no heading #nowhere in packages/ui-router-server.md`,
      ],
    );
  });
});

describe('published packages', () => {
  const links = packageLinks();

  it('link only site pages, worker routes and redirect sources, headings included', async () => {
    assert.ok(links.length > 0);
    assert.deepEqual(
      (
        await Promise.all(
          links.map(async ({ file, url }) => {
            const problem = await linkProblem(url);

            return problem ? [`${file}: ${problem}`] : [];
          }),
        )
      ).flat(),
      [],
    );
  });

  it('list every path they link in catalog/published-urls.txt, before it ships', () => {
    assert.deepEqual(
      unlistedLinks(links, publishedUrls()),
      [],
      'add these lines to catalog/published-urls.txt',
    );
  });
});

describe('catalog/published-urls.txt', () => {
  const urls = publishedUrls();

  it('lists paths released tarballs link, each of which still resolves, headings included', async () => {
    assert.ok(urls.length > 0);
    assert.deepEqual(
      await entryProblems(urls),
      [],
      'a released tarball links each of these and cannot be republished: keep a page or a redirect at each, and an old heading id with {#old-id}',
    );
  });

  it('marks each redirect rule with exactly the packages whose listed paths it catches', () => {
    const expected = new Map<string, string[]>();

    for (const { path, packages } of urls) {
      const rule = REDIRECTS.find(
        (candidate) =>
          matchRedirect(spellings(candidate), path.split('#')[0]) !== null,
      );

      if (!rule) continue;

      expected.set(
        rule.from,
        [...new Set([...(expected.get(rule.from) ?? []), ...packages])].sort(),
      );
    }

    const marked = new Map(
      REDIRECTS.flatMap(({ from, linkedFrom }) =>
        linkedFrom ? [[from, [...linkedFrom].sort()] as const] : [],
      ),
    );

    assert.deepEqual(marked, expected);
  });
});
