import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { getAllByRole, queryAllByRole } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import { EXAMPLE_NAMES, EXAMPLES, RESERVED_NAMES } from 'examples/embeds';
import { createMarkdownRenderer } from 'vitepress';

import { EXAMPLE_FACETS } from '../../catalog/examples.ts';
import {
  dependencyFacets,
  EMPTY_LIVE_EXAMPLES,
  embeddingPages,
  exampleFacets,
  exampleIndex,
  exampleIndexData,
  headingSlug,
  kindOf,
  linkedSummary,
  LIVE_EXAMPLES,
  liveExamples,
  locationOf,
  summaryLinks,
  unembeddedExamples,
} from '../example-index.ts';
import { linkProblem, ORIGIN } from '../published-links.ts';
import { splitReferences } from '../theme/components/faceted-index.ts';

const site = join(import.meta.dirname, '../..');

const md = await createMarkdownRenderer(site);

/** Markdown the index writes, rendered as VitePress renders the examples index. */
const render = async (markdown: string) =>
  parseHtml(
    await md.renderAsync(markdown, {
      path: join(site, 'examples/index.md'),
      relativePath: 'examples/index.md',
      cleanUrls: true,
    }),
  ).body;

const hrefs = (element: HTMLElement) =>
  queryAllByRole(element, 'link').map((link) => link.getAttribute('href'));

describe('the example facets', () => {
  it('take values from the vocabulary only', () => {
    for (const name of EXAMPLE_NAMES) {
      for (const [key, value] of Object.entries(exampleFacets(name))) {
        // SAFETY: exampleFacets builds its keys from the vocabulary; a stray key fails the lookup below
        const values: readonly string[] | undefined =
          EXAMPLE_FACETS[key as keyof typeof EXAMPLE_FACETS];

        assert.ok(values?.includes(value), `${name}: ${key} ${value}`);
      }
    }
  });

  it('read each example from its own files', () => {
    assert.equal(exampleFacets('helloworld-buildless').lang, 'js');
    assert.equal(exampleFacets('helloworld').location, 'hash');
    assert.equal(exampleFacets('navigation-api').location, 'navigation');
    assert.deepEqual(exampleFacets('hellosolarsystem-eleventy'), {
      kind: 'example',
      lang: 'ts',
      location: 'pushState',
      bindings: 'none',
      render: 'prerender',
      registry: 'off',
      lint: 'off',
    });
    assert.equal(exampleFacets('hellogalaxy-effect').bindings, 'effect');
    assert.equal(exampleFacets('lint-eslint').lint, 'on');
  });

  it('read a replace-aware hash location plugin as the hash location', () => {
    assert.equal(
      locationOf(['router.plugin(replaceAwareHashLocationPlugin);']),
      'hash',
    );
    assert.equal(exampleFacets('features-tour').location, 'hash');
    assert.throws(() => locationOf(['router.plugin(myHashLocationPlugin);']));
  });

  it('refuse sources with no location plugin or with two', () => {
    assert.throws(() => locationOf(['const x = 1;']));
    assert.throws(() =>
      locationOf([
        'router.plugin(hashLocationPlugin);',
        'router.plugin(pushStateLocationPlugin);',
      ]),
    );
  });

  it('refuse two bindings and an unprefixed package name', () => {
    assert.throws(() =>
      dependencyFacets({
        'lit-ui-router-mobx': '1',
        'lit-ui-router-effect': '1',
      }),
    );
    assert.throws(() => kindOf('my-app'));
  });
});

describe('the example index', () => {
  const list = exampleIndex();

  it('links every example', () => {
    for (const name of EXAMPLE_NAMES)
      assert.ok(list.includes(`(/examples/${name}/)`), name);
  });

  it('links the pages that embed an example', () => {
    assert.ok(
      embeddingPages()
        .get('hellogalaxy')
        ?.some(({ url }) => url === '/tutorial/hellogalaxy'),
    );
  });

  it('links each example to the page that embeds it, or to the live examples', () => {
    const pages = embeddingPages();

    for (const name of EXAMPLE_NAMES) {
      const { title } = EXAMPLES[name];
      const entry = list.split(`### ${title}\n`)[1]?.split('\n### ')[0] ?? '';
      const embedded = /^- Embedded in: (.+)$/m.exec(entry)?.[1] ?? '';

      const urls = pages.get(name)?.map(({ url }) => url) ?? [
        `${LIVE_EXAMPLES.url}#${headingSlug(title)}`,
      ];

      assert.deepEqual(
        Array.from(embedded.matchAll(/\]\(([^)]+)\)/g), ([, url]) => url),
        urls,
        name,
      );
    }
  });

  it('has a heading for every /examples/ anchor the docs link', () => {
    const slugs = new Set(
      Array.from(list.matchAll(/^#{2,3} (.+)$/gm), ([, heading]) =>
        headingSlug(heading),
      ),
    );

    const anchors = globSync('{guides,packages,tutorial}/**/*.md', {
      cwd: site,
    }).flatMap((file) =>
      Array.from(
        readFileSync(join(site, file), 'utf8').matchAll(
          /\(\/examples\/#([\w-]+)\)/g,
        ),
        ([, anchor]) => anchor,
      ),
    );

    assert.ok(anchors.length > 0);
    assert.deepEqual(
      anchors.filter((anchor) => !slugs.has(anchor)),
      [],
    );
  });
});

describe('the example links', () => {
  const linked = EXAMPLE_NAMES.filter((name) => summaryLinks(name).length > 0);

  it('link what each summary names once, in the order it names it', async () => {
    for (const name of EXAMPLE_NAMES) {
      const summary = await render(linkedSummary(name));

      assert.deepEqual(
        queryAllByRole(summary, 'link').map((link) => ({
          text: link.textContent,
          href: link.getAttribute('href'),
          external: link.getAttribute('target') === '_blank',
        })),
        summaryLinks(name).map(({ text, href, external = false }) => ({
          text: text.replaceAll('`', ''),
          href,
          external,
        })),
        name,
      );
    }
  });

  it('refuse a summary reference that names no link', () => {
    assert.throws(() => splitReferences('on [Effect]', []), {
      message: '[Effect] names no link in: on [Effect]',
    });
  });

  it('are listed under "Links", with no label on an entry that has none', async () => {
    const list = exampleIndex();

    assert.ok(linked.length > 0 && linked.length < EXAMPLE_NAMES.length);

    for (const name of EXAMPLE_NAMES) {
      const entry =
        list.split(`### ${EXAMPLES[name].title}\n`)[1]?.split(/\n#{2,3} /)[0] ??
        '';

      const rows = getAllByRole(await render(entry), 'listitem').filter(
        ({ textContent }) => textContent.startsWith('Links:'),
      );

      assert.deepEqual(
        rows.map(hrefs),
        linked.includes(name)
          ? [summaryLinks(name).map(({ href }) => href)]
          : [],
        name,
      );
    }
  });

  it('reach the faceted index as the links its summaries reference', () => {
    const { entries } = exampleIndexData();

    for (const name of EXAMPLE_NAMES) {
      const entry = entries.find(({ id }) => id === name);

      assert.deepEqual(entry?.summaryLinks, summaryLinks(name), name);
      assert.deepEqual(
        splitReferences(entry?.summary ?? '', entry?.summaryLinks).flatMap(
          ({ link }) => (link ? [link] : []),
        ),
        summaryLinks(name),
        name,
      );
    }
  });

  it('resolve on this site to a page, and to an anchor the page has', async () => {
    const internal = linked
      .flatMap(summaryLinks)
      .filter(({ external }) => !external);

    assert.ok(internal.some(({ href }) => href.includes('#')));
    assert.ok(internal.some(({ href }) => href.startsWith('/packages/')));
    assert.deepEqual(
      (
        await Promise.all(
          internal.map(({ href }) => linkProblem(`${ORIGIN}${href}`)),
        )
      ).filter(Boolean),
      [],
    );
  });
});

describe('the live examples page', () => {
  it('links what each summary names', async () => {
    const page = await render(liveExamples());

    for (const name of unembeddedExamples()) {
      for (const { href } of summaryLinks(name))
        assert.ok(hrefs(page).includes(href), `${name}: ${href}`);
    }
  });

  it('has examples to embed', () => {
    assert.notDeepEqual(unembeddedExamples(), [], EMPTY_LIVE_EXAMPLES);
  });

  it('embeds exactly the examples no other page embeds, each once', () => {
    const page = liveExamples();

    const embedded = Array.from(
      page.matchAll(/^<LiveExample name="([\w-]+)" \/>$/gm),
      ([, name]) => name,
    );

    const pages = embeddingPages();

    assert.deepEqual(
      embedded,
      EXAMPLE_NAMES.filter((name) => !pages.has(name)),
    );
  });

  it('carries the heading the examples index links for each embed', () => {
    const page = liveExamples();

    for (const name of unembeddedExamples())
      assert.ok(`\n${page}`.includes(`\n## ${EXAMPLES[name].title}\n`), name);

    const slugs = new Set(
      Array.from(page.matchAll(/^## (.+)$/gm), ([, heading]) =>
        headingSlug(heading),
      ),
    );

    const anchors = Array.from(
      exampleIndex().matchAll(/\(\/examples\/live#([\w-]+)\)/g),
      ([, anchor]) => anchor,
    );

    assert.ok(anchors.length > 0);
    assert.deepEqual(
      anchors.filter((anchor) => !slugs.has(anchor)),
      [],
    );
  });

  it('refuses to render with nothing to embed', () => {
    const everywhere = new Map(
      EXAMPLE_NAMES.map((name) => [name, [{ title: 'Guide', url: '/guide' }]]),
    );

    assert.throws(() => liveExamples(everywhere), {
      message: EMPTY_LIVE_EXAMPLES,
    });
  });

  it('owns every docs page under /examples/ by a reserved example name', () => {
    const reserved: readonly string[] = RESERVED_NAMES;

    const pages = globSync('examples/*.md', { cwd: site })
      .map((file) => file.replace(/^examples\/|\.md$/g, ''))
      .filter((slug) => slug !== 'index');

    assert.deepEqual(
      pages.filter((slug) => !reserved.includes(slug)),
      [],
    );
    assert.ok(reserved.includes(LIVE_EXAMPLES.url.replace('/examples/', '')));
  });
});
