import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
  type StateRule,
} from '@uirouter/core';

import { applyUrlConfig } from '../src/url-config.ts';
import type { RouterUrlConfig } from '../src/url-config.ts';

const bareRouter = (): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);

  return router;
};

// Fresh declarations per router: core mutates registrations ($$state).
const states = (): StateDeclaration[] => [
  { name: 'welcome', url: '/welcome' },
  { name: 'docs', url: '/docs/:section/page', params: { section: 'intro' } },
];

const matchedState = (router: UIRouter, path: string): string | undefined =>
  // SAFETY: these routers hold state rules only; no match is undefined.
  (router.urlService.match({ path })?.rule as StateRule | undefined)?.state
    .name;

const configured = (config: RouterUrlConfig): UIRouter => {
  const router = applyUrlConfig(bareRouter(), config);
  states().forEach((state) => router.stateRegistry.register(state));

  return router;
};

describe('applyUrlConfig', () => {
  it('keeps core defaults for undefined options', () => {
    const router = configured({});
    const { config } = router.urlService;

    assert.equal(config.strictMode(), true);
    assert.equal(config.caseInsensitive(), false);
    assert.equal(config.defaultSquashPolicy(), false);
    assert.equal(matchedState(router, '/welcome/'), undefined);
    assert.equal(matchedState(router, '/WELCOME'), undefined);
    assert.equal(matchedState(router, '/docs/page'), undefined);
  });

  it('compiles registered urls under strict, caseInsensitive and defaultSquashPolicy', () => {
    const router = configured({
      strict: false,
      caseInsensitive: true,
      defaultSquashPolicy: true,
    });

    assert.equal(matchedState(router, '/welcome/'), 'welcome');
    assert.equal(matchedState(router, '/WELCOME'), 'welcome');
    assert.equal(matchedState(router, '/docs/page'), 'docs');
    assert.equal(router.stateService.href('docs', {}), '#/docs/page');
  });

  it('applies a string squash policy', () => {
    const router = configured({ defaultSquashPolicy: '~' });

    assert.equal(matchedState(router, '/docs/~/page'), 'docs');
    assert.equal(router.stateService.href('docs', {}), '#/docs/~/page');
  });

  it('leaves an option the config omits at its current value', () => {
    const router = applyUrlConfig(bareRouter(), { strict: false });
    applyUrlConfig(router, { caseInsensitive: true });

    assert.equal(router.urlService.config.strictMode(), false);
    assert.equal(router.urlService.config.caseInsensitive(), true);
  });

  it('returns the router it was given, at its own type', () => {
    class TaggedRouter extends UIRouter {
      readonly tag = 'tagged';
    }

    const router = new TaggedRouter();

    const applied: TaggedRouter = applyUrlConfig(router);
    assert.equal(applied, router);
    assert.equal(applied.tag, 'tagged');
  });

  it("throws core's error for an invalid squash policy", () => {
    assert.throws(
      () =>
        applyUrlConfig(bareRouter(), {
          // oxlint-disable-next-line anti-slop/no-chained-type-assertions, anti-slop/require-safety-comment-for-type-assertion -- deliberately ill-typed policy exercises the runtime check
          defaultSquashPolicy: 5 as unknown as string,
        }),
      {
        message:
          'Invalid squash policy: 5. Valid policies: false, true, arbitrary-string',
      },
    );
  });

  describe('ordering guard', () => {
    it('throws once a state with a url is registered, naming it', () => {
      const router = bareRouter();
      router.stateRegistry.register({ name: 'welcome', url: '/welcome' });

      assert.throws(() => applyUrlConfig(router, { strict: false }), {
        message:
          "applyUrlConfig: state 'welcome' is already registered, and core compiled its url under the previous config. Apply the url config before registering states or url rules.",
      });
      assert.equal(router.urlService.config.strictMode(), true);
    });

    it('throws for an abstract state with a url', () => {
      const router = bareRouter();
      router.stateRegistry.register({
        name: 'app',
        url: '/app',
        abstract: true,
      });

      assert.throws(() => applyUrlConfig(router, {}), /state 'app'/);
    });

    it('throws once a string when() rule is registered', () => {
      const router = bareRouter();
      router.urlService.rules.when('/old', '/welcome');

      assert.throws(() => applyUrlConfig(router, {}), /a url rule/);
    });

    it('allows url-less states, RegExp rules and otherwise()', () => {
      const router = bareRouter();
      router.stateRegistry.register({ name: 'notFound' });
      router.urlService.rules.when(/^\/legacy/, '/welcome');
      router.urlService.rules.otherwise({ state: 'notFound' });

      assert.equal(applyUrlConfig(router, { strict: false }), router);
      assert.equal(router.urlService.config.strictMode(), false);
    });
  });
});
