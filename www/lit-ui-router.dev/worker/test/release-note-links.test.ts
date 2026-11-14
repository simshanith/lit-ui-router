import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  type MatchResult,
  type StateRule,
} from '@uirouter/core';
import { releaseLinks, SITE_URL } from '@tools/release-config/notes.ts';
import { createServerRouter } from 'ui-router-server';
import { applyUrlConfig } from 'ui-router-server/url-config';

import { DEFAULT_PRERELEASES, PRERELEASES_PARAM } from '../releases/lines.ts';
import {
  DEFAULT_FILTER,
  FILTER_PARAM,
} from '../releases/npm-diff/file-filter.ts';
import {
  mounts,
  RELEASES_MOUNT,
  releaseRoutes,
  urlConfig,
} from '../releases/routes.ts';

// Published GitHub release bodies are immutable, so every url their footer has ever linked must keep routing.

const linksOf = (footer: string): URL[] =>
  [...footer.matchAll(/\]\(([^)]+)\)/g)].map(([, href]) => new URL(href));

const pageRouter = (): UIRouter => {
  const router = applyUrlConfig(new UIRouter(), urlConfig);

  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);

  for (const route of releaseRoutes)
    router.stateRegistry.register({ ...route });

  return router;
};

const matchPage = (url: URL) => {
  assert.equal(url.origin, SITE_URL);
  assert.ok(url.pathname.startsWith(`${RELEASES_MOUNT}/`), url.pathname);

  // A miss returns undefined despite the declared type.
  const result: MatchResult | undefined = pageRouter().urlService.match({
    path: url.pathname.slice(RELEASES_MOUNT.length),
    search: {},
    hash: '',
  });

  // SAFETY: every registered rule is a state rule.
  const rule = result?.rule as StateRule | undefined;
  const params: unknown = result?.match;

  return { state: rule?.state.name, params };
};

const resolver = createServerRouter({ mounts });

const cases = [
  { pkg: 'lit-ui-router', version: '1.20.0', previous: '1.19.0' },
  { pkg: '@scope/name', version: '0.2.0', previous: '0.1.0' },
];

describe('the release-note footer links', () => {
  for (const { pkg, version, previous } of cases) {
    const [page, diff] = linksOf(releaseLinks(pkg, version, previous));

    it(`links ${pkg}@${version} to its version page`, async () => {
      assert.ok(page?.pathname.endsWith('/'));
      assert.deepEqual(matchPage(page), {
        state: 'releases.package.version',
        params: { pkg, version, [PRERELEASES_PARAM]: DEFAULT_PRERELEASES },
      });
      assert.deepEqual(await resolver.resolve(page), {
        kind: 'shell',
        mount: RELEASES_MOUNT,
      });
    });

    it(`links ${pkg} ${previous}...${version} to its compare page`, async () => {
      assert.ok(diff?.pathname.endsWith('/'));
      assert.deepEqual(matchPage(diff), {
        state: 'releases.package.compare',
        params: {
          pkg,
          from: previous,
          to: version,
          [PRERELEASES_PARAM]: DEFAULT_PRERELEASES,
          [FILTER_PARAM]: DEFAULT_FILTER,
        },
      });
      assert.deepEqual(await resolver.resolve(diff), {
        kind: 'shell',
        mount: RELEASES_MOUNT,
      });
    });
  }

  it('encodes a scoped name as one path segment', () => {
    const [page] = linksOf(releaseLinks('@scope/name', '0.2.0', ''));

    assert.equal(page?.pathname, '/releases/%40scope%2Fname/0.2.0/');
  });
});
