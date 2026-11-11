import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { EXAMPLE_NAMES, EXAMPLES, RESERVED_NAMES } from 'examples/embeds';

import { EXAMPLE_FACETS, SAMPLE_APPS } from '../../catalog/examples.ts';
import {
  dependencyFacets,
  EMPTY_LIVE_EXAMPLES,
  embeddingPages,
  exampleFacets,
  exampleIndex,
  headingSlug,
  kindOf,
  LIVE_EXAMPLES,
  liveExamples,
  locationOf,
  sampleAppFacets,
  unembeddedExamples,
} from '../example-index.ts';

const site = join(import.meta.dirname, '../..');

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

  it('read each sample-app mount from its app package', () => {
    assert.equal(
      sampleAppFacets(SAMPLE_APPS['/app-mobx'].app).bindings,
      'mobx',
    );
    assert.equal(sampleAppFacets(SAMPLE_APPS['/app'].app).bindings, 'none');
    assert.equal(sampleAppFacets(SAMPLE_APPS['/app'].app).registry, 'on');
  });
});

describe('the example index', () => {
  const list = exampleIndex();

  it('links every example and sample-app mount', () => {
    for (const name of EXAMPLE_NAMES)
      assert.ok(list.includes(`(/examples/${name}/)`), name);

    for (const mount of Object.keys(SAMPLE_APPS))
      assert.ok(list.includes(`(${mount})`), mount);
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

describe('the live examples page', () => {
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
