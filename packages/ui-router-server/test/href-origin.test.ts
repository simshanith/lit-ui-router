import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import {
  installServerLocation,
  serverLocationPlugin,
} from '../src/location.ts';
import type { ServerLocationOptions } from '../src/location.ts';

// ':lang' formats an empty segment, so the url starts with '//'.
const router = (options?: ServerLocationOptions): UIRouter => {
  const uiRouter = new UIRouter();
  uiRouter.plugin(servicesPlugin);
  installServerLocation(uiRouter, options);
  uiRouter.stateRegistry.register({ name: 'new', url: '/:lang/:slug?tab' });
  uiRouter.stateRegistry.register({ name: 'mid', url: '/a/:x/b' });

  return uiRouter;
};

const HOSTILE = { lang: '', slug: 'evil.example' };

const ORIGIN = 'http://localhost';

const CASES = [
  { name: 'at /', options: {}, href: '/evil.example' },
  {
    name: 'under /app/',
    options: { baseHref: '/app/' },
    href: '/app/evil.example',
  },
] as const;

describe('an href formatted under serverLocationPlugin', () => {
  for (const { name, options, href } of CASES) {
    describe(name, () => {
      it('starts with one slash when its leading param is empty', () => {
        const formatted = router(options).stateService.href('new', HOSTILE);

        assert.equal(formatted, href);
        assert.match(formatted, /^\/(?!\/)/);
      });

      it('has one slash after the origin when absolute', () => {
        const formatted = router(options).stateService.href('new', HOSTILE, {
          absolute: true,
        });

        assert.equal(formatted, `${ORIGIN}${href}`);
        assert.match(formatted.slice(ORIGIN.length), /^\/(?!\/)/);
      });

      it('keeps its query', () => {
        assert.equal(
          router(options).stateService.href('new', { ...HOSTILE, tab: 'a' }),
          `${href}?tab=a`,
        );
      });

      it('leaves a well-formed href as core formats it', () => {
        const prefix = href.slice(0, -'/evil.example'.length);
        const params = { lang: 'en', slug: 'intro' };

        assert.equal(
          router(options).stateService.href('new', params),
          `${prefix}/en/intro`,
        );
        assert.equal(
          router(options).stateService.href('new', params, { absolute: true }),
          `${ORIGIN}${prefix}/en/intro`,
        );
      });

      it('leaves an empty param below the first segment as core formats it', () => {
        const prefix = href.slice(0, -'/evil.example'.length);

        assert.equal(
          router(options).stateService.href('mid', { x: '' }),
          `${prefix}/a//b`,
        );
      });
    });
  }

  it('starts with one slash on a router that installs the plugin itself', () => {
    const uiRouter = new UIRouter();
    uiRouter.plugin(servicesPlugin);
    uiRouter.plugin(serverLocationPlugin);
    uiRouter.stateRegistry.register({ name: 'new', url: '/:lang/:slug' });

    assert.equal(uiRouter.stateService.href('new', HOSTILE), '/evil.example');
    assert.equal(
      uiRouter.stateService.href('new', HOSTILE, { absolute: true }),
      `${ORIGIN}/evil.example`,
    );
  });

  it('is still null for params the url rejects', () => {
    const uiRouter = new UIRouter();
    uiRouter.plugin(servicesPlugin);
    uiRouter.plugin(serverLocationPlugin);
    uiRouter.stateRegistry.register({ name: 'num', url: '/{id:int}' });

    assert.equal(uiRouter.stateService.href('num', { id: 'x' }), null);
  });

  it('keeps the fragment core formats for a hash client, which cannot name a host', () => {
    const uiRouter = router({ html5Mode: false, baseHref: '/app/' });

    assert.equal(uiRouter.stateService.href('new', HOSTILE), '#//evil.example');
    assert.equal(
      uiRouter.stateService.href('new', HOSTILE, { absolute: true }),
      `${ORIGIN}/app/#//evil.example`,
    );
  });

  it('formats as core does again once the plugin is disposed', () => {
    const uiRouter = new UIRouter();
    uiRouter.plugin(servicesPlugin);
    const plugin = uiRouter.plugin(serverLocationPlugin);
    uiRouter.stateRegistry.register({ name: 'new', url: '/:lang/:slug' });

    uiRouter.dispose(plugin);
    // Core's memory plugin, told to format paths, without this package's href handling.
    uiRouter.plugin(memoryLocationPlugin);
    uiRouter.locationConfig.html5Mode = () => true;

    assert.equal(uiRouter.stateService.href('new', HOSTILE), '//evil.example');
  });
});
