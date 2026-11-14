import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import {
  getAllByRole,
  getByRole,
  getByText,
  queryAllByRole,
  queryByRole,
  queryByText,
  waitFor,
  within,
} from '@testing-library/dom';
import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';

import '../define.ts';
import { DevtoolsPlugin } from '../plugin.ts';
import type { DevtoolsPanel } from '../element/panel.ts';
import { UIRouterDevtools } from '../ui-router-devtools.ts';

const routers: UIRouter[] = [];

const bareRouter = (): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  routers.push(router);

  return router;
};

const makeRouter = (): UIRouter => {
  const router = bareRouter();
  router.stateRegistry.register({ name: 'home', url: '/home' });

  return router;
};

// SAFETY: testing-library types its container as HTMLElement and only calls querySelectorAll on it
const shadow = (element: UIRouterDevtools): HTMLElement =>
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- a ShadowRoot is a DocumentFragment, never an HTMLElement
  element.renderRoot as unknown as HTMLElement;

afterEach(() => {
  for (const router of routers.splice(0)) router.dispose();
  document.body.replaceChildren();
  localStorage.clear();
});

it('defines <ui-router-devtools>', () => {
  expect(customElements.get('ui-router-devtools')).toBe(UIRouterDevtools);
});

it('shows the pill with the current state and opens the panel', async () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  const element = devtools.element;
  await router.stateService.go('home');
  await element.updateComplete;

  const pill = await waitFor(() =>
    getByRole(shadow(element), 'button', { name: /Router .*home/ }),
  );

  expect(pill.matches(':popover-open')).toBe(true);

  pill.click();
  await element.updateComplete;

  const panel = getByRole(shadow(element), 'region', {
    name: 'Router devtools',
  });

  expect(panel.matches(':popover-open')).toBe(true);
  expect(pill.matches(':popover-open')).toBe(false);
  await waitFor(() =>
    expect(
      getByRole(shadow(element), 'button', { name: 'Collapse devtools' }),
    ).toBe(element.shadowRoot?.activeElement),
  );
});

it('collapses to the pill, and switches views from the tabs and the Router button', async () => {
  await page.viewport(400, 800);
  const router = makeRouter();
  const { element } = router.plugin(DevtoolsPlugin);
  const panel = panelOf(element);
  await router.stateService.go('home');
  await element.updateComplete;
  getByRole(shadow(element), 'button', { name: /Router .*home/ }).click();
  await element.updateComplete;

  const tab = (name: string) =>
    getByRole(shadow(element), 'tab', { name: new RegExp(name) });

  tab('Transitions').click();
  await element.updateComplete;
  expect(tab('Transitions').getAttribute('aria-selected')).toBe('true');

  tab('Router').click();
  await element.updateComplete;
  expect(tab('Router').getAttribute('aria-selected')).toBe('true');

  tab('States').click();
  await element.updateComplete;
  expect(panel._inspect).toBe('none');
  expect(tab('States').getAttribute('aria-selected')).toBe('true');

  // The Router button stands in for the tabs once the panes sit side by side.
  await page.viewport(1280, 800);

  const brand = await waitFor(() =>
    getByRole(shadow(element), 'button', { name: 'Router', pressed: false }),
  );

  brand.click();
  await element.updateComplete;
  expect(brand.getAttribute('aria-pressed')).toBe('true');
  brand.click();
  await element.updateComplete;
  expect(brand.getAttribute('aria-pressed')).toBe('false');

  getByRole(shadow(element), 'button', { name: 'Collapse devtools' }).click();
  await element.updateComplete;

  const pill = getByRole(shadow(element), 'button', { name: /Router .*home/ });
  expect(pill.matches(':popover-open')).toBe(true);
  expect(element.shadowRoot?.activeElement).toBe(pill);
  expect(
    shadow(element).querySelector('.panel')?.matches(':popover-open'),
  ).toBe(false);
});

it('marks the state whose resolve failed, and says why in the inspector', async () => {
  await page.viewport(1280, 800);
  const router = makeRouter();
  router.stateService.defaultErrorHandler(() => {});
  router.stateRegistry.register({
    name: 'item',
    url: '/item/:id',
    resolve: [
      {
        token: 'data',
        resolveFn: () => Promise.reject(new Error('no data')),
      },
    ],
  });
  const { element } = router.plugin(DevtoolsPlugin, { timeResolves: true });
  const panel = panelOf(element);
  await router.stateService.go('item', { id: '7' }).catch(() => {});
  await element.updateComplete;

  const failed = panel._model.txs.find((tx) => tx.to === 'item')!;
  panel._selectTx(failed.id);
  await element.updateComplete;

  const item = panel._model.states.find((state) => state.name === 'item')!;
  expect(panel._role(item)).toBe('errored');

  const inspector = shadow(element).querySelector('.inspector-pane')!;
  expect(inspector.querySelector('.reason')?.textContent).toContain('no data');
  expect(inspector.querySelector('.params')?.textContent).toContain('7');
});

it('opens the ancestors of a state named in the inspector and selects it', async () => {
  await page.viewport(1280, 800);
  const router = bareRouter();
  router.stateRegistry.register({ name: 'a' });
  router.stateRegistry.register({ name: 'a.b' });
  const { element } = router.plugin(DevtoolsPlugin);
  const panel = panelOf(element);
  await router.stateService.go('a.b');
  await element.updateComplete;

  panel._selectTx(panel._model.txs[0].id);
  panel._collapsed = new Set(['a']);
  await element.updateComplete;

  const link = shadow(element).querySelector<HTMLElement>(
    '.inspector-pane .link[title="a.b"]',
  )!;

  link.click();
  await element.updateComplete;

  expect(panel._selectedState).toBe('a.b');
  expect(panel._inspect).toBe('state');
  expect(panel._collapsed.has('a')).toBe(false);
});

it('removes the element when the plugin is disposed', () => {
  const router = makeRouter();
  const devtools = router.plugin(DevtoolsPlugin);
  expect(document.body.contains(devtools.element)).toBe(true);
  router.dispose(devtools);
  expect(document.body.contains(devtools.element)).toBe(false);
});

const pending = (router: UIRouter) => {
  router.stateRegistry.register({
    name: 'slow',
    url: '/slow',
    resolve: [{ token: 'never', resolveFn: () => new Promise(() => {}) }],
  });
  void router.stateService.go('slow').catch(() => {});
};

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// SAFETY: the registered class is DevtoolsPanel; the public type hides its render state
const panelOf = (element: UIRouterDevtools) => element as DevtoolsPanel;

it('stops ticking when removed mid-transition', async () => {
  const router = makeRouter();
  const panel = panelOf(router.plugin(DevtoolsPlugin).element);
  pending(router);
  await waitFor(() => expect(panel._runningTx?.to).toBe('slow'));

  const ticking = panel._now;
  await waitFor(() => expect(panel._now).not.toBe(ticking));

  panel.remove();
  await panel.updateComplete;
  const removed = panel._now;
  await tick(350);

  expect(panel._now).toBe(removed);
});

it("ends an imported running transition at the export's clock", async () => {
  const router = makeRouter();
  const panel = panelOf(router.plugin(DevtoolsPlugin).element);
  pending(router);
  await waitFor(() => expect(panel._runningTx?.to).toBe('slow'));

  // The exporting page's clock ran far ahead of this one.
  const session = panel.session({ params: 'all' })!;
  const took = session.t - panel._runningTx!.t;
  panel.importSession({
    ...session,
    t: session.t + 1e7,
    events: session.events.map((event) => ({ ...event, t: event.t + 1e7 })),
  });
  await panel.updateComplete;

  expect(panel._duration(panel._runningTx!)).toBeCloseTo(took, 6);
  await tick(250);
  expect(panel._duration(panel._runningTx!)).toBeCloseTo(took, 6);
});

it('draws the default-child arrow to a lazy child', async () => {
  const router = makeRouter();
  router.stateRegistry.register({ name: 'admin', redirectTo: 'admin.users' });
  router.stateRegistry.register({
    name: 'admin.users.**',
    url: '/users',
    lazyLoad: () => new Promise(() => {}),
  });
  const element = router.plugin(DevtoolsPlugin).element;
  await element.updateComplete;

  await waitFor(() =>
    expect(shadow(element).querySelectorAll('.rail-initial')).toHaveLength(1),
  );
});

describe('session files', () => {
  const open = async () => {
    await page.viewport(1280, 800);

    const router = makeRouter();

    const { element } = router.plugin(DevtoolsPlugin, {
      redaction: { params: ['id'] },
    });

    await router.stateService.go('home');
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router .*home/ }).click();
    await element.updateComplete;

    return { router, element };
  };

  const importFile = (element: UIRouterDevtools, text: string) => {
    const input = element.renderRoot.querySelector<HTMLInputElement>('.file')!;
    const files = new DataTransfer();
    files.items.add(new File([text], 'session.json'));
    input.files = files.files;
    input.dispatchEvent(new Event('change'));
  };

  it('exports the session as a JSON file named for its router', async () => {
    const { element } = await open();
    const panel = panelOf(element);
    const blobs: Blob[] = [];
    const names: string[] = [];

    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      // SAFETY: Export only ever passes a Blob
      blobs.push(blob as Blob);

      return 'blob:session';
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      names.push(this.download);
    });

    getByRole(shadow(element), 'button', {
      name: 'Export session as JSON',
    }).click();

    expect(names).toEqual([
      expect.stringMatching(
        new RegExp(`^ui-router-session-${panel.recorder!.routerId}-.*\\.json$`),
      ),
    ]);
    // The envelope's clock is read at export, so only it differs from a fresh read.
    expect(JSON.parse(await blobs[0].text())).toEqual({
      ...JSON.parse(JSON.stringify(panel._exportSession())),
      t: expect.any(Number),
    });
    vi.restoreAllMocks();
  });

  it('says a file that is not JSON did not import', async () => {
    const { element } = await open();
    importFile(element, 'not json');

    await waitFor(() =>
      expect(
        shadow(element).querySelector('.notice.fault')?.textContent,
      ).toContain('session.json is not JSON'),
    );
  });

  it('imports a dropped file, and the Live button returns to the router', async () => {
    const { router, element } = await open();
    const panel = panelOf(element);
    const files = new DataTransfer();
    files.items.add(
      new File(
        [JSON.stringify(element.session({ params: 'all' }))],
        'session.json',
      ),
    );

    const region = getByRole(shadow(element), 'region', {
      name: 'Router devtools',
    });

    const over = new DragEvent('dragover', { cancelable: true, bubbles: true });
    region.dispatchEvent(over);
    expect(over.defaultPrevented).toBe(true);
    region.dispatchEvent(
      new DragEvent('drop', {
        dataTransfer: files,
        cancelable: true,
        bubbles: true,
      }),
    );

    await waitFor(() => expect(panel._imported).not.toBeNull());

    getByRole(shadow(element), 'button', {
      name: 'Live: return to the live router',
    }).click();
    await element.updateComplete;

    expect(panel._imported).toBeNull();
    expect(panel._announcement).toBe('Showing the live router.');
    expect(panel._model.current.name).toBe(router.globals.current.name);
  });

  it('refuses a session of another schema version', async () => {
    const { element } = await open();
    const session = element.session({ params: 'all' })!;

    // SAFETY: a file from a later major version, as importSession would receive it
    expect(() => element.importSession({ ...session, v: 2 } as never)).toThrow(
      'Unsupported session version 2; expected 1',
    );
  });

  it('says so when the session reader fails to load, and loads it on the next import', async () => {
    const { element } = await open();
    const panel = panelOf(element);
    const session = JSON.stringify(element.session({ params: 'all' }));
    const load = panel._importReader;
    panel._importReader = () => Promise.reject(new Error('chunk failed'));
    importFile(element, session);

    await waitFor(() =>
      expect(
        shadow(element).querySelector('.notice.fault')?.textContent,
      ).toContain('the session reader did not load'),
    );

    panel._importReader = load;
    importFile(element, session);

    await waitFor(() => expect(panel._imported).not.toBeNull());
    expect(shadow(element).querySelector('.notice.fault')).toBeNull();
  });

  it('says in the panel why a file that is not a session did not import', async () => {
    const { element } = await open();
    importFile(element, JSON.stringify({ name: 'package.json' }));

    await waitFor(() =>
      expect(
        shadow(element).querySelector('.notice.fault')?.textContent,
      ).toContain('not a ui-router session file'),
    );
  });

  it('imports a session with an unknown event type and says what it skipped', async () => {
    const { element } = await open();
    const session = element.session({ params: 'all' })!;

    importFile(
      element,
      JSON.stringify({
        ...session,
        later: true,
        events: [...session.events, { v: 1, seq: 99, t: 1, type: 'teleport' }],
      }),
    );

    await waitFor(() =>
      expect(shadow(element).querySelector('.notice')?.textContent).toContain(
        '1 event',
      ),
    );
    expect(
      getByRole(shadow(element), 'button', { name: /^Live/ }),
    ).toBeTruthy();
  });

  it('says how many events and spans an import skipped, in the plural or singular each needs', async () => {
    const { element } = await open();
    const session = element.session({ params: 'all' })!;
    const later = (seq: number) => ({ v: 1, seq, t: 1, type: 'teleport' });
    const span = { traceId: 't', spanId: 's', name: 'GET', startTime: 1 };

    importFile(
      element,
      JSON.stringify({
        ...session,
        events: [...session.events, later(98), later(99)],
        spans: [span, { spanId: 'no trace' }],
      }),
    );
    await waitFor(() =>
      getByText(
        shadow(element),
        '2 events of a kind this version does not read and 1 span that did not read skipped',
      ),
    );

    getByRole(shadow(element), 'button', { name: /^Live/ }).click();
    await element.updateComplete;
    importFile(
      element,
      JSON.stringify({ ...session, spans: [{ name: 'a' }, { name: 'b' }] }),
    );
    await waitFor(() =>
      getByText(shadow(element), '2 spans that did not read skipped'),
    );
  });

  it("re-exports an imported session under the recording's id, generator and stricter redaction", async () => {
    const { element } = await open();
    const live = element.session({ params: 'all' })!;

    const recorded = {
      ...live,
      id: 'recording-1',
      generator: { name: 'another-recorder', version: '9.9.9' },
      redaction: { params: ['id', 'q'], messages: false },
    };

    importFile(element, JSON.stringify(recorded));
    await waitFor(() =>
      expect(element.session({ params: 'all' })?.id).toBe('recording-1'),
    );

    expect(element.session({ params: ['q', 'page'] })).toMatchObject({
      id: 'recording-1',
      generator: { name: 'another-recorder', version: '9.9.9' },
      redaction: { params: ['q'], messages: false },
    });
  });

  it('notes at the end of the log how many events the recorder dropped', async () => {
    await page.viewport(1280, 800);

    const router = makeRouter();
    router.stateRegistry.register({ name: 'away', url: '/away' });

    const element = document.createElement('ui-router-devtools');
    element.history = 1;
    element.router = router;
    document.body.append(element);

    for (let i = 0; i < 12; i++)
      await router.stateService.go(i % 2 ? 'home' : 'away');
    await element.updateComplete;

    const dropped = element.recorder?.dropped ?? 0;
    expect(dropped).toBeGreaterThan(0);
    expect(
      shadow(element)
        .querySelector('.dropped')
        ?.textContent?.replace(/\s+/g, ' '),
    ).toContain(`${dropped} earlier events dropped`);
  });

  it('lets the Param values toggle redact or keep values whatever the redaction option says', async () => {
    await page.viewport(1280, 800);

    for (const [params, off] of [
      ['all', '[redacted]'],
      [['id'], '7'],
      [[], '[redacted]'],
    ] as const) {
      const router = makeRouter();
      router.stateRegistry.register({ name: 'item', url: '/item/:id' });

      const { element } = router.plugin(DevtoolsPlugin, {
        redaction: { params },
      });

      await router.stateService.go('item', { id: '7' });
      await element.updateComplete;
      getByRole(shadow(element), 'button', { name: /Router .*item/ }).click();
      await element.updateComplete;
      const panel = panelOf(element);

      const values = within(
        getByRole(shadow(element), 'group', { name: 'Export keeps' }),
      ).getByRole('button', { name: 'Param values' });

      const exported = () =>
        panel._exportSession()?.events.find((e) => e.type === 'current');

      for (const keep of [false, true]) {
        if ((values.getAttribute('aria-pressed') === 'true') !== keep) {
          values.click();
          await element.updateComplete;
        }

        expect(exported()).toMatchObject({
          params: { id: keep ? '7' : off },
        });
      }

      router.dispose();
      document.body.replaceChildren();
    }
  });

  it('lets the Messages toggle drop failure messages from the export', async () => {
    await page.viewport(1280, 800);
    const router = makeRouter();
    router.stateService.defaultErrorHandler(() => {});
    router.stateRegistry.register({
      name: 'boom',
      onEnter: () => {
        throw new Error('boom failed');
      },
    });

    const { element } = router.plugin(DevtoolsPlugin);
    await router.stateService.go('boom').catch(() => {});
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;

    const messages = () =>
      panelOf(element)
        ._exportSession()
        ?.events.flatMap((event) =>
          event.type === 'result' && event.message ? [event.message] : [],
        );

    expect(messages()).toEqual(['boom failed']);

    within(getByRole(shadow(element), 'group', { name: 'Export keeps' }))
      .getByRole('button', { name: 'Messages' })
      .click();
    await element.updateComplete;

    expect(messages()).toEqual([]);
  });

  it('starts the export toggles from the redaction option', async () => {
    const { element } = await open();

    const toggles = getByRole(shadow(element), 'group', {
      name: 'Export keeps',
    });

    const values = within(toggles).getByRole('button', {
      name: 'Param values',
    });

    expect(values.getAttribute('aria-pressed')).toBe('false');
    expect(
      within(toggles)
        .getByRole('button', { name: 'Messages' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(element.session()?.redaction).toEqual({
      params: ['id'],
      messages: true,
    });
  });
});

describe('the nested Map', () => {
  // The sample app's tree: one root, two compounds, three levels under mymessages.
  const sampleRouter = (): UIRouter => {
    const router = bareRouter();

    for (const name of [
      'app',
      'app.welcome',
      'app.login',
      'app.notFound',
      'app.contacts',
      'app.contacts.contact',
      'app.contacts.contact.edit',
      'app.contacts.new',
      'app.mymessages',
      'app.mymessages.compose',
      'app.mymessages.messagelist',
      'app.mymessages.messagelist.message',
    ])
      router.stateRegistry.register({ name, abstract: name === 'app' });

    return router;
  };

  const MESSAGE = 'app.mymessages.messagelist.message';

  const openMap = async (width: number, height = 800, sheet = '') => {
    await page.viewport(width, height);

    const router = sampleRouter();
    const { element } = router.plugin(DevtoolsPlugin);
    element.style.cssText = sheet;

    for (const state of [
      'app.login',
      'app.mymessages.messagelist',
      MESSAGE,
      'app.contacts.contact',
      MESSAGE,
      'app.mymessages.messagelist',
      MESSAGE,
    ])
      await router.stateService.go(state);

    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'map' }).click();
    await element.updateComplete;

    return element;
  };

  const tree = (element: UIRouterDevtools) =>
    waitFor(() => getByRole(shadow(element), 'tree', { name: 'State map' }));

  const edges = (element: UIRouterDevtools) =>
    element.renderRoot.querySelectorAll('.nedge');

  // The room left around the diagram inside the Map viewport's content box, per side.
  const margins = (element: UIRouterDevtools) => {
    const scroller = element.renderRoot.querySelector('.map-scroll')!;
    const style = getComputedStyle(scroller);
    const outer = scroller.getBoundingClientRect();

    const rect = element.renderRoot
      .querySelector('.nested > .box')!
      .getBoundingClientRect();

    return {
      left: rect.left - outer.left - parseFloat(style.paddingLeft),
      right: outer.right - parseFloat(style.paddingRight) - rect.right,
      top: rect.top - outer.top - parseFloat(style.paddingTop),
      bottom: outer.bottom - parseFloat(style.paddingBottom) - rect.bottom,
    };
  };

  const settled = (element: UIRouterDevtools) =>
    waitFor(() =>
      expect(
        [...element.renderRoot.querySelectorAll('.nested, .box')].flatMap(
          (box) => box.getAnimations().filter((a) => a.id.startsWith('uird-')),
        ),
      ).toHaveLength(0),
    );

  it('is a tree of treeitems holding groups, named by header', async () => {
    const element = await openMap(1280);
    const map = await tree(element);
    const app = getByRole(map, 'treeitem', { name: 'app' });
    const messages = getByRole(map, 'treeitem', { name: 'mymessages' });
    const message = getByRole(map, 'treeitem', { name: 'message' });

    expect(app.getAttribute('aria-expanded')).toBe('true');
    expect(message.hasAttribute('aria-expanded')).toBe(false);
    expect(message.getAttribute('aria-current')).toBe('true');
    expect(message.getAttribute('aria-selected')).toBe('false');

    // Each header owns the group in its box, and that group holds the child items.
    const owned = (item: HTMLElement) =>
      element.renderRoot.querySelector<HTMLElement>(
        `#${item.getAttribute('aria-owns')}`,
      )!;

    expect(owned(app).getAttribute('role')).toBe('group');
    expect(owned(app).parentElement).toBe(app.parentElement);
    expect(owned(app).contains(messages)).toBe(true);
    expect(
      within(owned(messages)).getByRole('treeitem', { name: 'messagelist' }),
    ).toBeTruthy();
    expect(message.hasAttribute('aria-owns')).toBe(false);
    expect(
      getAllByRole(map, 'treeitem').filter((item) => item.tabIndex === 0),
    ).toEqual([message]);
    expect(map.querySelector('svg.nedges')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });

  it('loads the Map on first use of the Map tab', async () => {
    const router = sampleRouter();
    const { element } = router.plugin(DevtoolsPlugin);
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;

    const panel = panelOf(element);
    expect(panel._map).toBeUndefined();
    getByRole(shadow(element), 'button', { name: 'map' }).click();
    await waitFor(() => expect(panel._map).toBeDefined());
    expect(await tree(element)).toBeTruthy();
  });

  it('leads a redirect to its lazy child', async () => {
    await page.viewport(1280, 800);
    const router = bareRouter();
    router.stateRegistry.register({ name: 'admin', redirectTo: 'admin.users' });
    router.stateRegistry.register({ name: 'admin.home' });
    router.stateRegistry.register({
      name: 'admin.users.**',
      url: '/users',
      lazyLoad: () => new Promise(() => {}),
    });
    const { element } = router.plugin(DevtoolsPlugin);
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'map' }).click();
    await tree(element);

    await waitFor(() =>
      expect(
        [...element.renderRoot.querySelectorAll('.box.led')].map((box) =>
          box.getAttribute('data-name'),
        ),
      ).toEqual(['admin.users.**']),
    );
  });

  it('says so when the Map fails to load, and retries when the Map is chosen again', async () => {
    await page.viewport(1280, 800);
    const router = sampleRouter();
    const { element } = router.plugin(DevtoolsPlugin);
    const panel = panelOf(element);
    const load = panel._importMap;
    panel._importMap = () => Promise.reject(new Error('chunk failed'));
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;

    const view = (name: 'outline' | 'map') =>
      getByRole(shadow(element), 'button', { name }).click();

    view('map');
    await waitFor(() =>
      getByText(shadow(element), /The Map did not load/, { selector: 'p' }),
    );
    expect(getByRole(shadow(element), 'status').textContent).toContain(
      'The Map did not load',
    );
    expect(panel._map).toBeUndefined();

    panel._importMap = load;
    view('outline');
    await element.updateComplete;
    view('map');

    expect(await tree(element)).toBeTruthy();
    expect(queryByText(shadow(element), /The Map did not load/)).toBeNull();
  });

  it("keeps boxes at their natural size in the dock, with the popover's column free, and enlarges them maximised", async () => {
    const element = await openMap(1280);
    const map = await tree(element);

    const pills = (height: number, widest: number) => {
      for (const name of ['login', 'message', 'edit']) {
        const pill = getByRole(map, 'treeitem', { name }).parentElement!;
        const rect = pill.getBoundingClientRect();
        const text = pill.querySelector('.name')!;

        expect(rect.height).toBe(height);
        expect(rect.width).toBeLessThanOrEqual(widest);
        // A pill is its label and padding, so its text is never clipped and never has slack beside it.
        expect(text.scrollWidth).toBeLessThanOrEqual(text.clientWidth);
        expect(rect.right - text.getBoundingClientRect().right).toBeLessThan(
          height,
        );
      }
    };

    await settled(element);
    const dock = margins(element);

    // The diagram is centred when a column is free either side, and otherwise as near the middle as leaves one free at the end.
    expect(Math.abs(dock.top - dock.bottom)).toBeLessThanOrEqual(1);
    expect(dock.left).toBeGreaterThanOrEqual(0);
    expect(dock.left).toBeLessThanOrEqual(dock.right + 1);
    expect(dock.right).toBeGreaterThanOrEqual(320);
    pills(24, 208);

    getByRole(shadow(element), 'button', { name: 'Maximise devtools' }).click();
    await waitFor(() => {
      const scroller = element.renderRoot.querySelector('.map-scroll')!;
      expect(scroller.clientHeight).toBeGreaterThan(300);
    });
    await settled(element);
    const max = margins(element);

    expect(Math.abs(max.left - max.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(max.top - max.bottom)).toBeLessThanOrEqual(1);
    // Maximised, the diagram takes a larger step and still keeps a margin.
    expect(max.left).toBeGreaterThan(40);
    expect(max.top).toBeGreaterThan(12);
    expect(
      getComputedStyle(element.renderRoot.querySelector('.nested')!).fontSize,
    ).not.toBe('12px');

    const { height } = getByRole(map, 'treeitem', {
      name: 'login',
    }).parentElement!.getBoundingClientRect();

    expect([32, 40]).toContain(height);
    pills(height, 348);
    // Maximised, the full log and the inspector sit below the diagram.
    expect(
      getByRole(shadow(element), 'heading', { name: /Inspector/ }),
    ).toBeTruthy();
    expect(queryByRole(shadow(element), 'listbox')).toBeNull();
  });

  it('moves nothing when a state is selected, and keeps the popover off the selected box', async () => {
    for (const width of [1280, 1000]) {
      const element = await openMap(width);
      const map = await tree(element);
      await settled(element);

      const rects = () =>
        [...element.renderRoot.querySelectorAll('.box')].map((box) => {
          const { x, y, width: w, height: h } = box.getBoundingClientRect();

          return [x, y, w, h];
        });

      const before = rects();

      for (const name of ['message', 'login', 'contacts']) {
        const item = getByRole(map, 'treeitem', { name });
        item.click();
        await waitFor(() =>
          expect(item.getAttribute('aria-selected')).toBe('true'),
        );
        await element.updateComplete;

        expect(rects()).toEqual(before);

        const box = item.parentElement!.getBoundingClientRect();

        await waitFor(() => {
          const popover = element.renderRoot
            .querySelector('.inspector-pane')!
            .getBoundingClientRect();

          expect(popover.width).toBeGreaterThan(0);
          expect(
            popover.left >= box.right ||
              popover.right <= box.left ||
              popover.top >= box.bottom ||
              popover.bottom <= box.top,
          ).toBe(true);
        });
      }

      element.remove();
    }
  });

  it('closes and opens a compound from its fold button', async () => {
    const element = await openMap(1280);
    const map = await tree(element);

    getByRole(map, 'button', { name: 'Collapse contacts' }).click();
    await waitFor(() =>
      expect(
        getByRole(map, 'treeitem', { name: 'contacts 3' }).getAttribute(
          'aria-expanded',
        ),
      ).toBe('false'),
    );

    // The collapsing box and the root that shrinks around it ease their size as well as their place.
    const sized = (name: string) =>
      element.renderRoot
        .querySelector(`.box[data-name="${name}"]`)!
        .getAnimations()
        .flatMap((animation) =>
          animation.id === 'uird-flip' &&
          animation.effect instanceof KeyframeEffect
            ? animation.effect.getKeyframes()
            : [],
        )
        .some((frame) => 'width' in frame && 'height' in frame);

    expect(sized('app.contacts')).toBe(true);
    expect(sized('app')).toBe(true);
    await settled(element);
    expect(queryByRole(map, 'treeitem', { name: 'edit' })).toBeNull();
    expect(
      getByRole(map, 'treeitem', { name: 'contacts 3' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('false');

    getByRole(map, 'button', { name: 'Expand contacts' }).click();
    await waitFor(() =>
      expect(getByRole(map, 'treeitem', { name: 'edit' })).toBeTruthy(),
    );
  });

  it('colours a state by its depth on the Map and in the Outline, and by status while a transition is in focus', async () => {
    const element = await openMap(1280);
    const map = await tree(element);

    const box = (name: string) =>
      getByRole(map, 'treeitem', { name }).parentElement!;

    const border = (name: string) =>
      getComputedStyle(box(name), '::before').borderTopColor;

    // Siblings share a colour, a child differs from its parent, and the cycle comes round after four levels.
    expect(box('app').classList.contains('d1')).toBe(true);
    expect(box('message').classList.contains('d4')).toBe(true);
    expect(border('login')).toBe(border('contacts'));
    expect(border('mymessages')).not.toBe(border('app'));
    expect(border('messagelist')).not.toBe(border('mymessages'));
    expect(getComputedStyle(box('message'), '::before').borderTopWidth).toBe(
      '2px',
    );

    const resting = border('messagelist');

    const options = getAllByRole(
      getByRole(shadow(element), 'listbox', { name: /Transitions/ }),
      'option',
    );

    // The second transition enters mymessages and messagelist.
    options[1].click();
    await waitFor(() =>
      expect(
        getByRole(shadow(element), 'region', { name: 'Router devtools' })
          .dataset.mode,
      ).toBe('tx'),
    );
    await waitFor(() => {
      expect(border('messagelist')).not.toBe(resting);
      expect(border('messagelist')).toBe(border('mymessages'));
    });
    expect(border('contacts')).not.toBe(border('messagelist'));
  });

  it('rings a selected box outside its border, and leaves the border saying what it said in every mode', async () => {
    const element = await openMap(1280);
    const map = await tree(element);

    const box = (name: string) =>
      getByRole(map, 'treeitem', { name }).parentElement!;

    const border = (name: string) => {
      const style = getComputedStyle(box(name), '::before');

      return [style.borderTopColor, style.borderTopWidth, style.borderTopStyle];
    };

    const ring = (name: string) => {
      const style = getComputedStyle(box(name));

      return [style.outlineStyle, style.outlineWidth, style.outlineOffset];
    };

    const mode = () =>
      getByRole(shadow(element), 'region', { name: 'Router devtools' }).dataset
        .mode;

    const select = async (name: string) => {
      getByRole(map, 'treeitem', { name }).click();
      await waitFor(() =>
        expect(
          getByRole(map, 'treeitem', { name }).getAttribute('aria-selected'),
        ).toBe('true'),
      );
    };

    // Identity at rest: the ring is added and the border keeps its colour, weight and line.
    const resting = border('messagelist');

    expect(ring('messagelist')[0]).toBe('none');
    await select('messagelist');
    expect(mode()).toBe('state');
    expect(ring('messagelist')).toEqual(['solid', '1px', '2px']);
    expect(border('messagelist')).toEqual(resting);
    // The ring is the ink, which is no depth's colour.
    expect(getComputedStyle(box('messagelist')).outlineColor).toBe(
      getComputedStyle(element).color,
    );

    for (const name of ['app', 'mymessages', 'messagelist', 'message'])
      expect(getComputedStyle(box(name)).outlineColor).not.toBe(
        border(name)[0],
      );

    // Status while a transition is in focus: the selected box wears the status colour its neighbours do.
    const options = getAllByRole(
      getByRole(shadow(element), 'listbox', { name: /Transitions/ }),
      'option',
    );

    options[1].click();
    await waitFor(() => expect(mode()).toBe('tx'));
    // The colour eases, so it is read once it has settled on its neighbour's.
    await waitFor(() => {
      expect(border('messagelist')).not.toEqual(resting);
      expect(border('messagelist')[0]).toBe(border('mymessages')[0]);
      expect(map.getAnimations({ subtree: true })).toHaveLength(0);
    });

    const status = border('mymessages');

    expect(ring('messagelist')).toEqual(['solid', '1px', '2px']);
    await select('mymessages');
    expect(mode()).toBe('tx');
    await waitFor(() => expect(border('mymessages')).toEqual(status));
    expect(ring('mymessages')).toEqual(['solid', '1px', '2px']);
    expect(ring('messagelist')[0]).toBe('none');

    // Keyboard focus is a ring inside the border, so it is told from the selection ring outside it.
    const head = getByRole(map, 'treeitem', { name: 'mymessages' });

    head.focus({ focusVisible: true });
    await waitFor(() =>
      expect(getComputedStyle(head).outlineStyle).toBe('solid'),
    );
    expect(parseFloat(getComputedStyle(head).outlineOffset)).toBeLessThan(-2);
    expect(getComputedStyle(head).outlineWidth).toBe('2px');
  });

  it('moves focus in tree order with the arrow keys', async () => {
    const element = await openMap(1280);
    const map = await tree(element);
    const item = (name: string) => getByRole(map, 'treeitem', { name });

    const press = (key: string) =>
      element.shadowRoot?.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
      );

    item('message').focus();
    press('ArrowUp');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(item('messagelist')),
    );
    press('ArrowLeft');
    await waitFor(() =>
      // collapsed, its label carries the count of the states inside
      expect(item('messagelist 1').getAttribute('aria-expanded')).toBe('false'),
    );
    expect(queryByRole(map, 'treeitem', { name: 'message' })).toBeNull();
    press('ArrowRight');
    await waitFor(() => expect(item('message')).toBeTruthy());
  });

  it("draws no edge at rest and a state's traffic once it is selected", async () => {
    const element = await openMap(1280);
    const map = await tree(element);
    expect(edges(element)).toHaveLength(0);

    getByRole(map, 'treeitem', { name: 'message' }).click();
    // messagelist to message and back as a stub each, and one line both ways between contact and message
    await waitFor(() => expect(edges(element)).toHaveLength(3));
    expect(
      getByRole(map, 'treeitem', { name: 'message' }).getAttribute(
        'aria-selected',
      ),
    ).toBe('true');
    expect(element.renderRoot.querySelectorAll('.nedge.w2')).toHaveLength(1);
    expect(
      [...edges(element)].map((edge) => edge.querySelectorAll('.head').length),
    ).toEqual(expect.arrayContaining([1, 1, 2]));

    // The count is a chip only where it is more than one: messagelist to message, twice.
    const chips = element.renderRoot.querySelectorAll('.chip');
    expect([...chips].map((chip) => chip.textContent?.trim())).toEqual(['×2']);

    await settled(element);

    // Geometry is read in the diagram's own coordinates, which every engine reports alike.
    const origin = element.renderRoot
      .querySelector('.nested')!
      .getBoundingClientRect();

    const inDiagram = (target: Element) => {
      const rect = target.getBoundingClientRect();

      return {
        left: rect.left - origin.left,
        right: rect.right - origin.left,
        top: rect.top - origin.top,
        bottom: rect.bottom - origin.top,
      };
    };

    const [x, y] = chips[0]
      .getAttribute('transform')!
      .match(/-?[\d.]+/g)!
      .map(Number);

    const plate = chips[0].querySelector('rect')!;
    const right = x + Number(plate.getAttribute('width'));
    const bottom = y + Number(plate.getAttribute('height'));

    // The chip is clear of every box's header and of every pill.
    for (const head of element.renderRoot.querySelectorAll('.box > .head')) {
      const rect = inDiagram(head);

      expect(
        x >= rect.right ||
          right <= rect.left ||
          y >= rect.bottom ||
          bottom <= rect.top,
      ).toBe(true);
    }

    // The stubs between messagelist and message end on the header's bottom edge, not on a border.
    const list = inDiagram(getByRole(map, 'treeitem', { name: 'messagelist' }));

    const message = inDiagram(
      getByRole(map, 'treeitem', { name: 'message' }).parentElement!,
    );

    const stubs = [...edges(element)].flatMap((edge) => {
      const line = edge.querySelector<SVGPathElement>('.line')!.getBBox();

      return line.width < 1 ? [line] : [];
    });

    expect(stubs).toHaveLength(2);

    for (const stub of stubs) {
      expect(stub.y).toBeGreaterThanOrEqual(list.bottom - 1);
      expect(stub.y + stub.height).toBeLessThanOrEqual(message.top + 1);
      expect(stub.x).toBeGreaterThan(message.left);
      expect(stub.x).toBeLessThan(message.right);
    }

    // The inspector names the same relations in words; each one selects and focuses its box.
    const inspector = getByRole(shadow(element), 'group', {
      name: /Inspector/,
    });

    expect(inspector.textContent).toMatch(/Arrived/);
    expect(inspector.textContent).toMatch(/Left/);
    within(inspector).getAllByRole('button', { name: 'contact' })[0].click();

    const contact = await waitFor(() => {
      const box = getByRole(map, 'treeitem', { name: 'contact' });
      expect(box.getAttribute('aria-selected')).toBe('true');

      return box;
    });

    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(contact),
    );
  });

  it('shows a selected transition from the scrubber as an edge', async () => {
    const element = await openMap(1280);
    await tree(element);

    const listbox = getByRole(shadow(element), 'listbox', {
      name: /Transitions/,
    });

    const options = getAllByRole(listbox, 'option');
    expect(options).toHaveLength(7);

    options[3].click();
    await waitFor(() => expect(edges(element)).toHaveLength(1));
    expect(options[3].getAttribute('aria-selected')).toBe('true');
    expect(listbox.getAttribute('aria-activedescendant')).toBe(options[3].id);

    listbox.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    await waitFor(() =>
      expect(
        getAllByRole(listbox, 'option')[4].getAttribute('aria-selected'),
      ).toBe('true'),
    );
  });

  it('places the inspector popover clear of the selection, its edges and the boxes they end at', async () => {
    // Wide enough that the popover has room beside the diagram.
    const element = await openMap(1680);
    const map = await tree(element);
    getByRole(map, 'treeitem', { name: 'message' }).click();
    await waitFor(() => expect(edges(element)).toHaveLength(3));

    await waitFor(() => {
      const panel = getByRole(shadow(element), 'region', {
        name: 'Router devtools',
      });

      const popover = element.renderRoot
        .querySelector('.inspector-pane')!
        .getBoundingClientRect();

      const bounds = panel.getBoundingClientRect();

      expect(popover.width).toBeGreaterThan(0);
      expect(popover.left).toBeGreaterThanOrEqual(bounds.left);
      expect(popover.right).toBeLessThanOrEqual(bounds.right);
      expect(popover.bottom).toBeLessThanOrEqual(bounds.bottom);

      for (const name of ['message', 'messagelist', 'contact']) {
        const box = getByRole(map, 'treeitem', {
          name,
        }).parentElement!.getBoundingClientRect();

        expect(popover.left >= box.right || popover.right <= box.left).toBe(
          true,
        );
      }
    });
  });

  const nestedRoot = (element: UIRouterDevtools) =>
    element.renderRoot.querySelector<HTMLElement>('.nested')!;

  // Each box's place inside the diagram, which a change of view leaves alone.
  const placesIn = (element: UIRouterDevtools) => {
    const origin = nestedRoot(element).getBoundingClientRect();

    return [...element.renderRoot.querySelectorAll('.box')].map((box) => {
      const rect = box.getBoundingClientRect();

      return [
        Math.round(rect.x - origin.x),
        Math.round(rect.y - origin.y),
        rect.width,
        rect.height,
      ];
    });
  };

  it('keeps the layout and re-fits the view when the panel is resized to the same shape', async () => {
    const element = await openMap(1280);
    await tree(element);
    await settled(element);

    const before = placesIn(element);
    const fitted = margins(element);

    await page.viewport(1240, 800);
    await waitFor(() => expect(margins(element).left).not.toBe(fitted.left));
    await settled(element);

    const after = margins(element);

    expect(placesIn(element)).toEqual(before);
    expect(Math.abs(after.top - after.bottom)).toBeLessThanOrEqual(1);
    expect(after.right).toBeGreaterThanOrEqual(320);
    expect(element.renderRoot.querySelector('.minimap')).toBeNull();
    expect(
      getByRole(shadow(element), 'button', { name: 'Fit' }),
    ).toHaveProperty('disabled', true);
  });

  it('zooms in whole type steps, pans what then overflows, shows the minimap, and fits again', async () => {
    const element = await openMap(1280);
    const map = await tree(element);
    const scroller = element.renderRoot.querySelector('.map-scroll')!;
    const zoomIn = getByRole(shadow(element), 'button', { name: 'Zoom in' });
    const fit = getByRole(shadow(element), 'button', { name: 'Fit' });

    await settled(element);
    expect(getComputedStyle(nestedRoot(element)).fontSize).toBe('12px');
    expect(scroller.hasAttribute('data-pan')).toBe(false);

    zoomIn.click();
    await element.updateComplete;
    zoomIn.click();
    await waitFor(() =>
      expect(getComputedStyle(nestedRoot(element)).fontSize).toBe('20px'),
    );
    await settled(element);

    // The largest step is the last, and its diagram is taller than the dock.
    expect(zoomIn).toHaveProperty('disabled', true);
    expect(fit).toHaveProperty('disabled', false);
    expect(scroller.hasAttribute('data-pan')).toBe(true);
    expect(element.renderRoot.querySelector('.minimap')).toBeTruthy();
    expect(getComputedStyle(scroller).overflow).toBe('clip');

    // Every box sits on whole pixels: the view is a translation by whole pixels, never a scale.
    for (const box of element.renderRoot.querySelectorAll('.box')) {
      const rect = box.getBoundingClientRect();

      expect([rect.x, rect.y].map((value) => Math.abs(value % 1))).toEqual([
        0, 0,
      ]);
      expect(rect.height % 4).toBe(0);
    }

    const places = placesIn(element);

    // How far the top of the diagram is above the top of the room.
    const above = () =>
      scroller.getBoundingClientRect().top +
      parseFloat(getComputedStyle(scroller).paddingTop) -
      nestedRoot(element).getBoundingClientRect().top;

    // A press at the top of the minimap brings the top of the diagram into view.
    const mini = element.renderRoot.querySelector('.minimap')!;
    const thumb = mini.getBoundingClientRect();

    mini.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: thumb.x + thumb.width / 2,
        clientY: thumb.y + 5,
        pointerId: 1,
        bubbles: true,
      }),
    );
    await element.updateComplete;
    expect(above()).toBe(0);

    getByRole(map, 'treeitem', { name: 'app' }).focus();
    map.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        shiftKey: true,
        bubbles: true,
        composed: true,
      }),
    );
    await element.updateComplete;
    await settled(element);

    // Shift and an arrow pans, and moves neither focus nor any box inside the diagram.
    expect(above()).toBeGreaterThan(0);
    expect(above() % 1).toBe(0);
    expect(placesIn(element)).toEqual(places);
    expect(element.shadowRoot?.activeElement).toBe(
      getByRole(map, 'treeitem', { name: 'app' }),
    );

    fit.click();
    await waitFor(() =>
      expect(getComputedStyle(nestedRoot(element)).fontSize).toBe('12px'),
    );
    expect(element.renderRoot.querySelector('.minimap')).toBeNull();
    expect(fit).toHaveProperty('disabled', true);
  });

  it('pans by the wheel and by a drag, and changes the type step by the wheel with Control', async () => {
    const element = await openMap(1280);
    await tree(element);

    const scroller =
      element.renderRoot.querySelector<HTMLElement>('.map-scroll')!;

    const zoomIn = getByRole(shadow(element), 'button', { name: 'Zoom in' });

    zoomIn.click();
    await element.updateComplete;
    zoomIn.click();
    await waitFor(() =>
      expect(getComputedStyle(nestedRoot(element)).fontSize).toBe('20px'),
    );
    await settled(element);

    const above = () =>
      scroller.getBoundingClientRect().top +
      parseFloat(getComputedStyle(scroller).paddingTop) -
      nestedRoot(element).getBoundingClientRect().top;

    // A drag across the minimap follows the pointer only while the button is down.
    const mini = element.renderRoot.querySelector('.minimap')!;
    const thumb = mini.getBoundingClientRect();

    const glide = (y: number, buttons: number) =>
      mini.dispatchEvent(
        new PointerEvent('pointermove', {
          clientX: thumb.x + thumb.width / 2,
          clientY: y,
          buttons,
          bubbles: true,
        }),
      );

    glide(thumb.bottom - 1, 1);
    await element.updateComplete;
    const low = above();
    expect(low).toBeGreaterThan(0);
    glide(thumb.y + 1, 0);
    await element.updateComplete;
    expect(above()).toBe(low);

    const wheel = (init: WheelEventInit) => {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        ...init,
      });

      scroller.dispatchEvent(event);

      return event;
    };

    wheel({ deltaY: -10_000 });
    await element.updateComplete;
    expect(above()).toBe(0);

    // Past the top edge the wheel is left to scroll the page.
    expect(wheel({ deltaY: -40 }).defaultPrevented).toBe(false);

    expect(wheel({ deltaY: 40 }).defaultPrevented).toBe(true);
    await element.updateComplete;
    expect(above()).toBe(40);

    // A line-mode wheel moves 16px a line.
    wheel({ deltaY: -1, deltaMode: WheelEvent.DOM_DELTA_LINE });
    await element.updateComplete;
    expect(above()).toBe(24);

    const pointer = (type: string, x: number, y: number) =>
      new PointerEvent(type, {
        clientX: x,
        clientY: y,
        button: 0,
        pointerId: 1,
        bubbles: true,
        composed: true,
      });

    const start = scroller.getBoundingClientRect();
    const [x, y] = [start.x + 200, start.y + 200];

    // A press that moves less than the drag threshold pans nothing.
    scroller.dispatchEvent(pointer('pointerdown', x, y));
    window.dispatchEvent(pointer('pointermove', x, y - 2));
    window.dispatchEvent(pointer('pointerup', x, y - 2));
    await element.updateComplete;
    expect(above()).toBe(24);

    scroller.dispatchEvent(pointer('pointerdown', x, y));
    window.dispatchEvent(pointer('pointermove', x, y - 20));
    expect(scroller.hasAttribute('data-panning')).toBe(true);
    window.dispatchEvent(pointer('pointerup', x, y - 20));
    await element.updateComplete;

    expect(scroller.hasAttribute('data-panning')).toBe(false);
    expect(above()).toBe(44);

    // The click that ends a drag selects nothing.
    const app = getByRole(shadow(element), 'treeitem', { name: 'app' });
    app.click();
    await element.updateComplete;
    expect(panelOf(element)._selectedState).toBeNull();

    // The next click selects as usual.
    await tick(0);
    app.click();
    await element.updateComplete;
    expect(panelOf(element)._selectedState).toBe('app');

    // Control and the wheel change the type step once per notch, whatever the pan.
    wheel({ deltaY: 30, ctrlKey: true });
    await element.updateComplete;
    expect(getComputedStyle(nestedRoot(element)).fontSize).toBe('20px');
    expect(wheel({ deltaY: 30, ctrlKey: true }).defaultPrevented).toBe(true);
    await waitFor(() =>
      expect(getComputedStyle(nestedRoot(element)).fontSize).toBe('16px'),
    );

    getByRole(shadow(element), 'button', { name: 'Zoom out' }).click();
    await waitFor(() =>
      expect(getComputedStyle(nestedRoot(element)).fontSize).not.toBe('16px'),
    );
  });

  it('counts a line travelled both ways once in each direction', async () => {
    const element = await openMap(1280);
    const map = await tree(element);

    await element.router!.stateService.go('app.contacts.contact');
    await element.router!.stateService.go(MESSAGE);
    getByRole(map, 'treeitem', { name: 'message' }).click();

    await waitFor(() =>
      expect(
        [...element.renderRoot.querySelectorAll('.chip')].map((chip) =>
          [...chip.querySelectorAll('text')].map((text) => text.textContent),
        ),
      ).toEqual(expect.arrayContaining([['2', '2']])),
    );
  });

  it('pans a state into view when focus moves to it by keyboard', async () => {
    const element = await openMap(1280);
    const map = await tree(element);
    const scroller = element.renderRoot.querySelector('.map-scroll')!;
    const zoomIn = getByRole(shadow(element), 'button', { name: 'Zoom in' });

    zoomIn.click();
    await element.updateComplete;
    zoomIn.click();
    await waitFor(() =>
      expect(getComputedStyle(nestedRoot(element)).fontSize).toBe('20px'),
    );
    await settled(element);

    const press = (key: string) =>
      element.shadowRoot?.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
      );

    getByRole(map, 'treeitem', { name: 'app' }).focus();

    for (const key of ['End', 'Home']) {
      press(key);
      await element.updateComplete;
      await settled(element);

      const name = key === 'End' ? 'message' : 'app';

      await waitFor(() =>
        expect(element.shadowRoot?.activeElement).toBe(
          getByRole(map, 'treeitem', { name }),
        ),
      );

      // The header of the focused state is inside the Map's room.
      await waitFor(() => {
        const room = scroller.getBoundingClientRect();

        const head = getByRole(map, 'treeitem', {
          name,
        }).getBoundingClientRect();

        expect(head.top).toBeGreaterThanOrEqual(room.top);
        expect(head.bottom).toBeLessThanOrEqual(room.bottom);
      });
    }
  });

  it('remembers the chosen layout', async () => {
    const element = await openMap(1280);
    await tree(element);
    getByRole(shadow(element), 'button', { name: 'Tree' }).click();

    await waitFor(() =>
      expect(
        queryByRole(shadow(element), 'tree', { name: 'State map' }),
      ).toBeNull(),
    );
    expect(
      getByRole(shadow(element), 'group', { name: 'State map' }),
    ).toBeTruthy();
    expect(localStorage.getItem('ui-router-devtools:map-layout')).toBe('tree');

    element.remove();

    const next = await openMap(1280);
    await waitFor(() =>
      expect(
        getByRole(shadow(next), 'group', { name: 'State map' }),
      ).toBeTruthy(),
    );
    expect(queryAllByRole(shadow(next), 'tree')).toHaveLength(0);

    getByRole(shadow(next), 'button', { name: 'Nested' }).click();
    expect(await tree(next)).toBeTruthy();
    expect(localStorage.getItem('ui-router-devtools:map-layout')).toBe(
      'nested',
    );
  });

  it('shows the node-link tree, and does not offer nested boxes, under 560px', async () => {
    const element = await openMap(800, 800, '--uird-sheet-width: 480px');

    const nodeLink = await waitFor(() =>
      getByRole(shadow(element), 'group', { name: 'State map' }),
    );

    expect(nodeLink.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(
      queryByRole(shadow(element), 'tree', { name: 'State map' }),
    ).toBeNull();

    const nested = getByRole(shadow(element), 'button', { name: 'Nested' });
    expect(nested).toHaveProperty('disabled', true);
    expect(
      getByRole(shadow(element), 'button', { name: 'Tree' }).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
  });
});

describe('the Timeline', () => {
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const showTimeline = async (element: UIRouterDevtools) => {
    getByRole(shadow(element), 'button', { name: /Router/ }).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'timeline' }).click();
  };

  const open = async ({ timeResolves = true } = {}) => {
    await page.viewport(1280, 800);

    const router = makeRouter();
    router.stateRegistry.register({
      name: 'users',
      url: '/users',
      resolve: [{ token: 'users', resolveFn: () => sleep(20) }],
    });

    const { element } = router.plugin(DevtoolsPlugin, { timeResolves });

    await router.stateService.go('users');
    await element.updateComplete;
    await showTimeline(element);

    const tree = await waitFor(() =>
      getByRole(shadow(element), 'tree', { name: /Timeline/ }),
    );

    return { router, element, tree };
  };

  const press = (element: UIRouterDevtools, key: string) =>
    element.shadowRoot?.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, composed: true }),
    );

  // Whether the Timeline took the key: it prevents the default of a key it handles.
  const handles = (element: UIRouterDevtools, key: string): boolean => {
    const event = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    element.shadowRoot?.activeElement?.dispatchEvent(event);

    return event.defaultPrevented;
  };

  const details = (element: UIRouterDevtools, name: string | RegExp) =>
    queryByRole(shadow(element), 'region', { name });

  it('shows the latest transition as a tree of bars, each named with when it ran and how long it took', async () => {
    const { tree } = await open();
    const top = getByRole(tree, 'treeitem', { name: /^000 succeeded: users/ });

    expect(top.getAttribute('aria-level')).toBe('1');
    expect(top.getAttribute('aria-expanded')).toBe('true');
    expect(top.getAttribute('aria-label')).toMatch(/at 0 ms, took \d/);

    const resolve = getByRole(tree, 'treeitem', {
      name: /^resolve users, at /,
    });

    expect(resolve.getAttribute('aria-level')).toBe('2');
    // the duration is text in the row, not only a bar's length
    expect(resolve.textContent).toMatch(/\d+ ms/);
    expect(
      getAllByRole(tree, 'treeitem').map(
        (item) => item.getAttribute('aria-label')?.split(',')[0],
      ),
    ).toEqual(
      expect.arrayContaining(['before', 'start', 'enter users', 'success']),
    );
    // With no spans given, nothing about spans is drawn.
    expect(queryByText(tree, /during|in trace/i)).toBeNull();
  });

  it('moves, opens and closes with the tree keys, and shows a bar’s details on Enter', async () => {
    const { element, tree } = await open();
    const items = () => getAllByRole(tree, 'treeitem');
    const top = items()[0];

    top.focus();
    press(element, 'ArrowDown');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[1]),
    );
    press(element, 'End');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items().at(-1)),
    );
    press(element, 'Enter');
    await waitFor(() =>
      expect(items().at(-1)?.getAttribute('aria-selected')).toBe('true'),
    );
    expect(
      getByRole(shadow(element), 'region', { name: 'success' }),
    ).toBeTruthy();
    press(element, 'Escape');
    await waitFor(() =>
      expect(
        queryByRole(shadow(element), 'region', { name: 'success' }),
      ).toBeNull(),
    );

    press(element, 'ArrowLeft');
    await waitFor(() =>
      expect(element.shadowRoot?.activeElement).toBe(items()[0]),
    );
    press(element, 'ArrowLeft');
    await waitFor(() => expect(items()).toHaveLength(1));
    expect(items()[0].getAttribute('aria-expanded')).toBe('false');
    press(element, 'ArrowRight');
    await waitFor(() => expect(items().length).toBeGreaterThan(1));
  });

  it('nests a span that ran during the transition, says it only overlapped, and exports it redacted', async () => {
    const { router, element, tree } = await open();
    const panel = panelOf(element);
    const tx = panel._model.txs[0];
    const at = (t: number) => performance.timeOrigin + t;

    element.addSpan({
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      name: 'GET /api/users',
      startTime: at(tx.t + 1),
      attributes: { 'url.full': 'https://example.test/users?token=x' },
    });

    const fetch = await waitFor(() =>
      getByRole(tree, 'treeitem', { name: /^GET \/api\/users, .*during$/ }),
    );

    expect(fetch.getAttribute('aria-label')).toMatch(/running for/);

    element.addSpan({
      ...element.spans[0],
      endTime: at((tx.result?.t ?? tx.t) - 1),
      status: 'ok',
    });
    await waitFor(() =>
      expect(
        getByRole(tree, 'treeitem', { name: /^GET \/api\/users, .* took / }),
      ).toBeTruthy(),
    );
    expect(element.spans).toHaveLength(1);

    const exported = element.session();

    expect(exported?.spans).toEqual([
      expect.objectContaining({
        name: 'GET /api/users',
        attributes: { 'url.full': '[redacted]' },
      }),
    ]);
    expect(element.session({ params: 'all' })?.spans?.[0]?.attributes).toEqual({
      'url.full': 'https://example.test/users?token=x',
    });

    // An imported session shows its own spans, and the live ones stay with the live router.
    element.spans = [];
    element.importSession(exported!);
    await element.updateComplete;
    await waitFor(() =>
      getByRole(
        getByRole(shadow(element), 'tree', { name: /Timeline/ }),
        'treeitem',
        { name: /^GET \/api\/users/ },
      ),
    );
    expect(router.globals.current.name).toBe('users');
  });

  it('leaves the session file without spans when none were given', async () => {
    const { element } = await open();

    expect(element.session()).not.toHaveProperty('spans');
  });

  it('says so when the Timeline fails to load', async () => {
    await page.viewport(1280, 800);
    const router = makeRouter();
    const { element } = router.plugin(DevtoolsPlugin);
    const panel = panelOf(element);
    panel._importTimeline = () => Promise.reject(new Error('chunk failed'));
    await router.stateService.go('home');
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: /Router .*home/ }).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'timeline' }).click();

    await waitFor(() =>
      getByText(shadow(element), /The Timeline did not load/, {
        selector: 'p',
      }),
    );
    expect(panel._timeline).toBeUndefined();
    expect(getByRole(shadow(element), 'status').textContent).toContain(
      'The Timeline did not load',
    );

    // Choosing the Timeline again retries the load and clears the failure.
    panel._importTimeline = () => import('../element/timeline.ts');
    getByRole(shadow(element), 'button', { name: 'outline' }).click();
    await element.updateComplete;
    getByRole(shadow(element), 'button', { name: 'timeline' }).click();
    await waitFor(() =>
      getByRole(shadow(element), 'tree', { name: /Timeline/ }),
    );
    expect(getByRole(shadow(element), 'status').textContent).not.toContain(
      'did not load',
    );
  });

  it('selects a bar with a click and shows its details, and a second click hides them', async () => {
    const { element, tree } = await open();
    const resolve = getByRole(tree, 'treeitem', { name: /^resolve users, / });

    resolve.click();
    await waitFor(() =>
      expect(resolve.getAttribute('aria-selected')).toBe('true'),
    );

    const facts = within(details(element, 'resolve users')!);

    expect(facts.getByText('State').nextElementSibling?.textContent).toBe(
      'users',
    );
    expect(facts.getByText('Took').nextElementSibling?.textContent).toMatch(
      /^\d+ ms$/,
    );
    expect(facts.queryByText('Joined')).toBeNull();

    // A transition's details name no state of their own: the bar is the transition to it.
    const top = getAllByRole(tree, 'treeitem')[0];

    top.click();
    await waitFor(() => expect(details(element, 'users')).not.toBeNull());
    expect(within(details(element, 'users')!).queryByText('State')).toBeNull();

    top.click();
    await waitFor(() => expect(details(element, 'users')).toBeNull());
    expect(top.getAttribute('aria-selected')).toBe('false');
  });

  it('closes and opens an item from its fold mark without selecting it', async () => {
    const { tree } = await open();
    const top = () => getAllByRole(tree, 'treeitem')[0];

    // The fold mark is the pointer's way to do what the arrow keys do, so it has no role of its own.
    top().querySelector<HTMLElement>('.tl-fold')?.click();
    await waitFor(() => expect(getAllByRole(tree, 'treeitem')).toHaveLength(1));
    expect(top().getAttribute('aria-expanded')).toBe('false');
    expect(top().getAttribute('aria-selected')).toBe('false');

    top().querySelector<HTMLElement>('.tl-fold')?.click();
    await waitFor(() =>
      expect(getAllByRole(tree, 'treeitem').length).toBeGreaterThan(1),
    );
  });

  it('moves into an open item, up and home, and leaves keys it does not use alone', async () => {
    const { element, tree } = await open();
    const items = () => getAllByRole(tree, 'treeitem');
    const focused = () => element.shadowRoot?.activeElement;

    items()[0].focus();
    expect(handles(element, 'ArrowRight')).toBe(true);
    await waitFor(() => expect(focused()).toBe(items()[1]));

    // A leaf has nothing to open: the key is taken and focus stays.
    expect(handles(element, 'ArrowRight')).toBe(true);
    await element.updateComplete;
    expect(focused()).toBe(items()[1]);

    press(element, 'ArrowDown');
    await waitFor(() => expect(focused()).toBe(items()[2]));
    press(element, 'ArrowUp');
    await waitFor(() => expect(focused()).toBe(items()[1]));
    press(element, 'Home');
    await waitFor(() => expect(focused()).toBe(items()[0]));

    expect(handles(element, 'Escape')).toBe(false);
    expect(handles(element, 'a')).toBe(false);
  });

  it('mirrors left and right in a right-to-left page', async () => {
    const { element, tree } = await open();
    const top = () => getAllByRole(tree, 'treeitem')[0];

    element.setAttribute('dir', 'rtl');
    top().focus();
    press(element, 'ArrowRight');
    await waitFor(() =>
      expect(top().getAttribute('aria-expanded')).toBe('false'),
    );
    press(element, 'ArrowLeft');
    await waitFor(() =>
      expect(top().getAttribute('aria-expanded')).toBe('true'),
    );
  });

  it('shows a span’s status, ids, how it was joined and its attributes in its details', async () => {
    const { element, tree } = await open();
    const tx = panelOf(element)._model.txs[0];

    element.addSpan({
      traceId: 'c'.repeat(32),
      spanId: 'd'.repeat(16),
      name: 'GET /api/roles',
      startTime: performance.timeOrigin + tx.t + 1,
      attributes: { 'http.request.method': 'GET', tags: ['a', 'b'] },
    });

    const fetch = await waitFor(() =>
      getByRole(tree, 'treeitem', { name: /^GET \/api\/roles, / }),
    );

    fetch.click();

    const facts = within(
      await waitFor(() =>
        getByRole(shadow(element), 'region', { name: 'GET /api/roles' }),
      ),
    );

    // A span sent at its start, before it has a status, reads as unset.
    expect(facts.getByText('Status').nextElementSibling?.textContent).toBe(
      'unset',
    );
    expect(facts.getByText('Joined').nextElementSibling?.textContent).toBe(
      'during the transition, not traced to it',
    );
    expect(facts.getByText('Span').nextElementSibling?.textContent).toBe(
      'd'.repeat(16),
    );
    expect(facts.getByText('tags').nextElementSibling?.textContent).toBe(
      'a, b',
    );
  });

  it('lists resolves the session did not time, with no bar and a note in their details', async () => {
    const { element, tree } = await open({ timeResolves: false });

    const resolve = getByRole(tree, 'treeitem', {
      name: 'resolve users, untimed',
    });

    expect(resolve.textContent).toContain('—');

    resolve.click();

    const facts = within(
      await waitFor(() =>
        getByRole(shadow(element), 'region', { name: 'resolve users' }),
      ),
    );

    expect(facts.getByText('Note').nextElementSibling?.textContent).toBe(
      'untimed',
    );
    expect(facts.queryByText('Took')).toBeNull();
  });

  it('says when there is no transition to draw, and that an invalid target ran none', async () => {
    await page.viewport(1280, 800);

    const router = makeRouter();
    router.stateService.defaultErrorHandler(() => {});

    const { element } = router.plugin(DevtoolsPlugin);

    await element.updateComplete;
    await showTimeline(element);

    // The log says the same in its own pane, so the Timeline's pane is read alone.
    const pane = () =>
      within(getByRole(shadow(element), 'tabpanel', { name: /Timeline/ }));

    await waitFor(() =>
      expect(
        pane().getByText('No transitions yet.', { selector: 'p' }),
      ).toBeTruthy(),
    );
    expect(panelOf(element)._timeline).toBeDefined();

    await router.stateService.go('typo').catch(() => {});
    await waitFor(() =>
      expect(
        pane().getByText(/^Invalid target/, { selector: 'p' }).textContent,
      ).toMatch(/Invalid target\s+typo: no transition ran\./),
    );
  });

  it('draws an imported session: a long transition in seconds, and one of only ignored transitions', async () => {
    const { router, element } = await open();

    await router.stateService.go('users');

    const session = element.session()!;
    const start = session.events.find((event) => event.type === 'transition')!;

    // The first transition took a second and a half in this copy of the file.
    element.importSession({
      ...session,
      events: session.events.map((event) =>
        event.type === 'result' && event.id === 0
          ? { ...event, t: start.t + 1500 }
          : event,
      ),
    });

    const tree = () => getByRole(shadow(element), 'tree', { name: /Timeline/ });

    // The latest transition is ignored, so the latest one that ran is shown.
    await waitFor(() =>
      expect(
        getAllByRole(tree(), 'treeitem')[0].getAttribute('aria-label'),
      ).toMatch(/^000 succeeded: users, at 0 ms, took 1\.50 s/),
    );

    // A file whose ring buffer kept only the ignored transition still draws it.
    element.importSession({
      ...session,
      events: session.events.filter(
        (event) => !('id' in event) || event.id === 1,
      ),
    });
    await waitFor(() =>
      expect(
        getAllByRole(tree(), 'treeitem')[0].getAttribute('aria-label'),
      ).toMatch(/^001 ignored: users/),
    );
  });

  it('redraws when a list of the same length replaces the spans', async () => {
    const { element, tree } = await open();
    const tx = panelOf(element)._model.txs[0];
    const at = performance.timeOrigin + tx.t + 1;

    // Ended spans only, so no running span keeps the panel's clock ticking and redrawing on its own.
    const fetch = {
      traceId: 'a'.repeat(32),
      spanId: 'b'.repeat(16),
      name: 'GET /api/users',
      startTime: at,
      endTime: at + 5,
    };

    const item = (took: string) =>
      getByRole(tree, 'treeitem', {
        name: new RegExp(
          `^GET /api/users, at [\\d.]+ ms, took ${took}, during$`,
        ),
      });

    element.spans = [fetch];
    await waitFor(() => item('5\\.0 ms'));

    // The same span with a later end: one span in, one span out.
    element.spans = [{ ...fetch, endTime: at + 9 }];
    await waitFor(() => item('9\\.0 ms'));
  });

  it('leaves a span that overlaps no transition out of the session file', async () => {
    const { element } = await open();
    const tx = panelOf(element)._model.txs[0];
    const after = performance.timeOrigin + (tx.result?.t ?? tx.t) + 5000;

    element.addSpan({
      traceId: 'e'.repeat(32),
      spanId: 'f'.repeat(16),
      name: 'GET /api/later',
      startTime: after,
      endTime: after + 10,
    });

    expect(element.spans).toHaveLength(1);
    expect(element.session()).not.toHaveProperty('spans');
  });
});
