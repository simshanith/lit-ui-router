import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  after as t_after,
  afterEach,
  before,
  beforeEach,
  describe,
  it,
} from 'node:test';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

import { Window } from 'happy-dom';

import {
  revealOnStateLinks,
  stateUrlOf,
} from 'examples/features-tour/state-links';

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
      Element: window.Element,
      MouseEvent: window.MouseEvent,
      requestAnimationFrame: window.requestAnimationFrame.bind(window),
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
    router.stateRegistry.register({
      name: 'card',
      url: '/:cardId',
      // As the tour does: an unknown card redirects to the first.
      redirectTo: (transition) =>
        ['states', 'views', 'resolves'].includes(
          String(transition.params().cardId),
        )
          ? undefined
          : { state: 'card', params: { cardId: 'states' } },
    });
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
      [['/page#/views']],
    );
    router.dispose();
  });

  it('handles its own dispatched hashchange once: one transition per replace', async () => {
    const router = start({ prefix: 'tour' });

    await settled();

    let started = 0;

    router.transitionService.onStart({}, () => {
      started += 1;
    });
    await router.stateService.go(
      'card',
      { cardId: 'views' },
      { location: 'replace' },
    );
    await settled();
    assert.equal(started, 1);
    assert.equal(router.globals.params.cardId, 'views');
    router.dispose();
  });

  it("keeps the page's path and query under a <base href>", async () => {
    window.history.replaceState({ host: 1 }, '', '/docs/page?q=1');

    const base = window.document.createElement('base');

    base.setAttribute('href', '/app/');
    window.document.head.append(base);
    t_after(() => base.remove());

    const router = start({ prefix: 'tour' });

    await settled();
    await router.stateService.go(
      'card',
      { cardId: 'views' },
      { location: 'replace' },
    );
    assert.equal(
      window.location.href,
      'https://host.test/docs/page?q=1#tour/views',
    );
    router.dispose();
  });

  it('restores the state URL, not the bare prefix, when a transition is rolled back', async () => {
    const router = start({ prefix: 'tour' });

    await settled();
    // The default card wrote nothing.
    assert.equal(window.location.hash, '');

    window.history.pushState({}, '', '#tour/nope');
    hashchange();
    await settled();
    assert.equal(router.globals.params.cardId, 'states');
    assert.equal(window.location.hash, '#tour/states');

    // The bare state prefix with a slash is the app's root: the same card, the same URL.
    window.history.pushState({}, '', '#tour/');
    hashchange();
    await settled();
    assert.equal(window.location.hash, '#tour/states');
    router.dispose();
  });

  it('writes nothing for an empty URL before it has entered a state', () => {
    const router = new core.UIRouter();

    router.plugin(core.servicesPlugin);
    router.plugin(replaceAwareHashLocationPlugin, { prefix: 'tour' });
    router.urlService.url('', true);
    assert.equal(window.location.hash, '');
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

  describe('a state link inside the landmark', () => {
    const SVG = 'http://www.w3.org/2000/svg';

    let landmark: HTMLElement;
    let stop: () => void;
    let heard: string[];

    const hear = () => heard.push(window.location.hash);

    function link(href: string, parent = landmark) {
      const anchor = document.createElement('a');

      anchor.setAttribute('href', href);
      parent.append(anchor);

      return anchor;
    }

    /** Clicks `target` and reports whether the listener took the click. */
    function click(target: Element, init: MouseEventInit = {}) {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        composed: true,
        button: 0,
        ...init,
      });

      // The browser's own navigation is not under test: a click nothing took is cancelled at the window.
      window.addEventListener('click', swallow);
      target.dispatchEvent(event);
      window.removeEventListener('click', swallow);

      return taken;
    }

    let taken = false;

    function swallow(event: {
      defaultPrevented: boolean;
      preventDefault(): void;
    }) {
      taken = event.defaultPrevented;
      event.preventDefault();
    }

    beforeEach(() => {
      heard = [];
      landmark = document.createElement('section');
      document.body.append(landmark);
      stop = revealOnStateLinks(landmark, 'tour');
      window.addEventListener('hashchange', hear);
    });

    afterEach(() => {
      stop();
      landmark.remove();
      window.removeEventListener('hashchange', hear);
    });

    it('takes over the history entry, keeps history.state and tells the page', () => {
      const entries = window.history.length;

      assert.equal(click(link('#tour/views')), true);
      assert.equal(window.location.href, 'https://host.test/page#tour/views');
      assert.equal(window.history.length, entries);
      assert.deepEqual(window.history.state, { host: 1 });
      assert.deepEqual(heard, ['#tour/views']);
    });

    it('takes an SVG link as it does an HTML one', () => {
      const svg = document.createElementNS(SVG, 'svg');
      const anchor = document.createElementNS(SVG, 'a');
      const label = document.createElementNS(SVG, 'text');

      anchor.setAttribute('href', '#tour/resolves');
      anchor.append(label);
      svg.append(anchor);
      landmark.append(svg);

      assert.equal(click(label), true);
      assert.equal(window.location.hash, '#tour/resolves');
    });

    it('fires no hashchange for the fragment the page is on', () => {
      window.history.replaceState({ host: 1 }, '', '#tour/views');

      assert.equal(click(link('#tour/views')), true);
      assert.deepEqual(heard, []);
    });

    it('leaves a click that opens elsewhere to the browser', () => {
      assert.equal(click(link('#tour/views'), { metaKey: true }), false);
      assert.equal(click(link('#tour/views'), { button: 1 }), false);

      const targeted = link('#tour/views');

      targeted.setAttribute('target', '_blank');
      assert.equal(click(targeted), false);

      const download = link('#tour/views');

      download.setAttribute('download', '');
      assert.equal(click(download), false);
      assert.equal(window.location.hash, '');
    });

    it("leaves the page's anchors and other documents to the browser", () => {
      assert.equal(click(link('#tour')), false);
      assert.equal(click(link('#install')), false);
      assert.equal(click(link('/other#tour/views')), false);
      assert.equal(click(link('?q=1#tour/views')), false);
      assert.equal(window.location.hash, '');
    });

    it('leaves a click something else has handled', () => {
      const handled = link('#tour/views');

      handled.addEventListener('click', (event) => event.preventDefault());
      click(handled);
      assert.equal(window.location.hash, '');
      assert.deepEqual(heard, []);
    });

    it('leaves the history entry to a link outside the landmark', () => {
      const outside = link('#tour/views', document.body);

      assert.equal(click(outside), false);
      assert.equal(window.location.hash, '');
      outside.remove();
    });
  });
});
