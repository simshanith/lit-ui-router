import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { EXAMPLE_NAMES } from 'examples/embeds';

import { EXAMPLE_FACETS, SAMPLE_APPS } from '../../catalog/examples.ts';
import {
  dependencyFacets,
  embeddingPages,
  exampleFacets,
  exampleIndex,
  kindOf,
  locationOf,
  sampleAppFacets,
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

  it('has a heading for every /examples/ anchor the docs link', () => {
    const slugs = new Set(
      Array.from(list.matchAll(/^#{2,3} (.+)$/gm), ([, heading]) =>
        heading
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-'),
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
