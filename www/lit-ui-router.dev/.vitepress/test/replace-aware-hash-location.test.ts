import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { before, beforeEach, describe, it } from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { Window } from 'happy-dom';

import { stateUrlOf } from 'examples/features-tour/state-links';

describe('a fragment shared with the host page', () => {
  it('carries a state URL only behind the prefix', () => {
    assert.equal(stateUrlOf('#see-it-run/views', 'see-it-run'), '/views');
    assert.equal(stateUrlOf('#see-it-run', 'see-it-run'), undefined);
    assert.equal(stateUrlOf('#see-it-running/views', 'see-it-run'), undefined);
    assert.equal(stateUrlOf('#install', 'see-it-run'), undefined);
    assert.equal(stateUrlOf('', 'see-it-run'), undefined);
  });

  it('owns every #/ fragment with the empty prefix', () => {
    assert.equal(stateUrlOf('#/views'), '/views');
    assert.equal(stateUrlOf('#views'), undefined);
    assert.equal(stateUrlOf(''), undefined);
  });
});

describe('the replace-aware hash location', () => {
  type Core = typeof import('@uirouter/core');

  type Plugin =
    typeof import('examples/features-tour/replace-aware-hash-location').replaceAwareHashLocationPlugin;

  let core: Core;
  let replaceAwareHashLocationPlugin: Plugin;
  let window: Window;

  // @uirouter/core reads the global object as it loads, so the window comes first.
  before(async () => {
    window = new Window({ url: 'https://host.test/page' });
    Object.assign(globalThis, {
      window,
      self: window,
      document: window.document,
      location: window.location,
      history: window.history,
      HashChangeEvent: window.HashChangeEvent,
    });
    window.addEventListener = window.addEventListener.bind(window);
    window.removeEventListener = window.removeEventListener.bind(window);
    // The example's own copy, the one its location service extends.
    // SAFETY: require() is untyped; this is the package the type names.
    core = createRequire(
      join(workspaceRoot, 'examples/features-tour/package.json'),
    )('@uirouter/core') as Core;
    ({ replaceAwareHashLocationPlugin } =
      await import('examples/features-tour/replace-aware-hash-location'));
  });

  beforeEach(() => {
    window.history.replaceState({ host: 1 }, '', '/page');
  });

  function start(options: Parameters<Plugin>[1]) {
    const router = new core.UIRouter();

    router.plugin(core.servicesPlugin);
    router.plugin(replaceAwareHashLocationPlugin, options);
    router.stateRegistry.register({ name: 'card', url: '/:cardId' });
    router.urlService.rules.initial({
      state: 'card',
      params: { cardId: 'states' },
      options: { location: false },
    });
    router.urlService.listen();
    router.urlService.sync();

    return router;
  }

  const settled = () => new Promise((resolve) => setTimeout(resolve, 20));

  const hashchange = () =>
    window.dispatchEvent(new window.HashChangeEvent('hashchange'));

  it('opens on the initial state and leaves the URL as it was', async () => {
    const router = start({ prefix: 'tour' });

    await settled();
    assert.equal(router.globals.params.cardId, 'states');
    assert.equal(window.location.href, 'https://host.test/page');
    router.dispose();
  });

  it('activates the state a prefixed fragment names', async () => {
    window.history.replaceState({}, '', '#tour/views');

    const router = start({ prefix: 'tour' });

    await settled();
    assert.equal(router.globals.params.cardId, 'views');
    router.dispose();
  });

  it("keeps its state through the page's own anchors", async () => {
    window.history.replaceState({}, '', '#tour/views');

    const router = start({ prefix: 'tour' });

    await settled();
    window.history.pushState({}, '', '#install');
    hashchange();
    await settled();
    assert.equal(router.globals.params.cardId, 'views');
    assert.equal(router.urlService.url(), '/views');

    window.history.pushState({}, '', '#tour');
    hashchange();
    await settled();
    assert.equal(router.globals.params.cardId, 'views');

    window.history.pushState({}, '', '#tour/resolves');
    hashchange();
    await settled();
    assert.equal(router.globals.params.cardId, 'resolves');
    router.dispose();
  });

  it('replaces in place, keeps history.state and tells the page', async () => {
    const router = start({ prefix: 'tour' });

    await settled();

    const entries = window.history.length;
    const heard: string[] = [];

    window.addEventListener('hashchange', () =>
      heard.push(window.location.hash),
    );

    await router.stateService.go(
      'card',
      { cardId: 'views' },
      { location: 'replace' },
    );
    assert.equal(window.location.hash, '#tour/views');
    assert.equal(window.history.length, entries);
    assert.deepEqual(window.history.state, { host: 1 });
    assert.deepEqual(heard, ['#tour/views']);
    router.dispose();
  });

  it('pushes an ordinary transition', async () => {
    const router = start({});

    await settled();

    const entries = window.history.length;

    await router.stateService.go('card', { cardId: 'views' });
    assert.equal(window.location.hash, '#/views');
    assert.equal(window.history.length, entries + 1);
    router.dispose();
  });

  // happy-dom's location.replace is not the browser's; the standalone example's e2e test covers the history entry.
  it('hands a replace to location.replace when asked to', async (t) => {
    const replaced = t.mock.method(window.location, 'replace', () => {});
    const router = start({ replace: 'location.replace' });

    await settled();
    await router.stateService.go(
      'card',
      { cardId: 'views' },
      { location: 'replace' },
    );
    assert.deepEqual(
      replaced.mock.calls.map((call) => call.arguments),
      [['#/views']],
    );
    router.dispose();
  });

  it('builds hrefs behind the prefix, as hand-written anchors are', () => {
    const tour = start({ prefix: 'tour' });

    assert.equal(
      tour.stateService.href('card', { cardId: 'views' }),
      '#tour/views',
    );
    tour.dispose();

    const bare = start({});

    assert.equal(
      bare.stateService.href('card', { cardId: 'views' }),
      '#/views',
    );
    bare.dispose();
  });

  it('stops listening when the router is disposed', async () => {
    const router = start({ prefix: 'tour' });

    await settled();
    router.dispose();
    window.history.pushState({}, '', '#tour/resolves');
    hashchange();
    await settled();
    assert.equal(router.globals.params.cardId, 'states');
  });
});
