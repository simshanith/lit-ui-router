import { describe, expect, it } from 'vitest';
import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  ViewService,
  type ActiveUIView,
  type PathNode,
  type StateDeclaration,
  type ViewConfig,
  type _ViewDeclaration,
} from '@uirouter/core';

import type { RouterEvent, ViewsEvent } from '../event-schema.ts';
import { observe } from '../router-events.ts';

// A renderer of no framework: its views are plain objects, and its view configs hold the declaration as written.
const TYPE = 'fake';

let configs = 0;

class FakeConfig implements ViewConfig {
  $id = ++configs;
  loaded = true;

  constructor(
    public path: PathNode[],
    public viewDecl: _ViewDeclaration,
  ) {}

  load(): Promise<ViewConfig> {
    return Promise.resolve(this);
  }
}

type Declared = Record<string, { component?: unknown }>;

const makeRouter = (states: StateDeclaration[]): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateService.defaultErrorHandler(() => {});
  router.viewService._pluginapi._viewConfigFactory(
    TYPE,
    (path: PathNode[], decl: _ViewDeclaration) => new FakeConfig(path, decl),
  );
  router.stateRegistry.decorator('views', (state) => {
    // SAFETY: the specs declare views as component holders
    const views = (state.self.views ?? {}) as Declared;

    return Object.fromEntries(
      Object.entries(views).map(([name, decl]) => {
        const target = ViewService.normalizeUIViewTarget(state, name);

        return [
          name,
          {
            ...decl,
            $type: TYPE,
            $context: state,
            $name: name,
            $uiViewName: target.uiViewName,
            $uiViewContextAnchor: target.uiViewContextAnchor,
          },
        ];
      }),
    );
  });

  for (const state of states) router.stateRegistry.register(state);

  return router;
};

let ids = 0;

// A view mounts inside its parent's content, so the state filling the parent is its creation context.
const mount = (router: UIRouter, name: string, parent?: ActiveUIView) => {
  const registration: Omit<ActiveUIView, 'config'> & { config?: ViewConfig } = {
    $type: TYPE,
    id: ++ids,
    name,
    fqn: parent ? `${parent.fqn}.${name}` : name,
    creationContext:
      parent?.config.viewDecl.$context ?? router.stateRegistry.root(),
    configUpdated: (config) => (registration.config = config),
  };

  // SAFETY: core configures a view before anything reads `config`, as lit-ui-router's `<ui-view>` relies on
  const view = registration as ActiveUIView;

  return { view, unmount: router.viewService.registerUIView(view) };
};

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));

const recording = (router: UIRouter, views = true) => {
  const events: RouterEvent[] = [];
  const stop = observe(router, (event) => events.push(event), { views });

  const snapshots = () =>
    events.filter((event): event is ViewsEvent => event.type === 'views');

  return { stop, snapshots, last: () => snapshots().at(-1) };
};

const component = class MessageList {};

// SAFETY: the fake renderer's views hold a component, which core's view declaration does not declare
const views = (declared: Declared) => declared as StateDeclaration['views'];

const STATES: StateDeclaration[] = [
  { name: 'home', views: views({ $default: { component: 'home-page' } }) },
  {
    name: 'mail',
    views: views({
      $default: { component: 'mail-page' },
      side: { component: 'mail-side' },
    }),
  },
  {
    name: 'mail.list',
    views: views({ list: { component } }),
  },
];

describe('views', () => {
  it('is off unless asked for', () => {
    const router = makeRouter(STATES);
    const { snapshots } = recording(router, false);

    expect(snapshots()).toEqual([]);
    router.dispose();
  });

  it('starts with a snapshot, empty when nothing is registered', () => {
    const router = makeRouter(STATES);
    const { last } = recording(router);

    expect(last()).toMatchObject({ views: [], unmatched: [] });
    router.dispose();
  });

  it('pairs each view with what fills it, and lists configs no view took', async () => {
    const router = makeRouter(STATES);
    const { last } = recording(router);
    const root = mount(router, '$default');

    await router.stateService.go('mail.list');
    const list = mount(router, 'list', root.view);
    await tick();

    expect(last()?.views).toEqual([
      {
        id: root.view.id,
        name: '$default',
        fqn: '$default',
        type: TYPE,
        context: '',
        fill: {
          state: 'mail',
          view: '$default',
          target: { name: '$default', anchor: '' },
          component: 'mail-page',
        },
      },
      {
        id: list.view.id,
        name: 'list',
        fqn: '$default.list',
        type: TYPE,
        context: 'mail',
        fill: {
          state: 'mail.list',
          view: 'list',
          target: { name: 'list', anchor: 'mail' },
          component: 'MessageList',
        },
      },
    ]);
    expect(last()?.unmatched).toEqual([
      {
        state: 'mail',
        view: 'side',
        target: { name: 'side', anchor: '' },
        component: 'mail-side',
      },
    ]);
    router.dispose();
  });

  it('drops a view its parent removed after the sync', async () => {
    const router = makeRouter(STATES);
    const { last } = recording(router);
    const root = mount(router, '$default');

    await router.stateService.go('mail.list');
    const list = mount(router, 'list', root.view);
    // The renderer removes the nested view in its own update, which core does not follow with a sync.
    const { configUpdated } = root.view;
    root.view.configUpdated = (config) => {
      configUpdated(config);
      queueMicrotask(list.unmount);
    };

    await router.stateService.go('home');
    await tick();

    expect(last()?.views.map((view) => [view.fqn, view.fill?.state])).toEqual([
      ['$default', 'home'],
    ]);
    router.dispose();
  });

  it('shows an emptied view as empty', async () => {
    const router = makeRouter(STATES);
    const { last } = recording(router);
    const root = mount(router, '$default');

    await router.stateService.go('home');
    mount(router, 'nowhere', root.view);
    await tick();

    expect(last()?.views.map((view) => [view.fqn, view.fill])).toEqual([
      ['$default', expect.objectContaining({ state: 'home' })],
      ['$default.nowhere', null],
    ]);
    router.dispose();
  });

  it('reads views registered before it started from what they hold', async () => {
    const router = makeRouter(STATES);
    mount(router, '$default');
    await router.stateService.go('home');

    const { last } = recording(router);

    expect(last()?.views.map((view) => view.fill?.state)).toEqual(['home']);
    router.dispose();
  });

  it('sends a snapshot only when the views changed, and none once stopped', async () => {
    const router = makeRouter(STATES);
    const { snapshots, stop } = recording(router);
    mount(router, '$default');
    await tick();
    const count = snapshots().length;

    router.viewService.sync();
    await tick();
    expect(snapshots()).toHaveLength(count);

    stop();
    await router.stateService.go('home');
    await tick();
    expect(snapshots()).toHaveLength(count);
    router.dispose();
  });

  it('leaves out a component with no name', async () => {
    const router = makeRouter([
      {
        name: 'anon',
        views: views({ $default: { component: [() => null][0] } }),
      },
    ]);

    const { last } = recording(router);
    mount(router, '$default');

    await router.stateService.go('anon');
    await tick();

    expect(last()?.views[0]?.fill).not.toHaveProperty('component');
    router.dispose();
  });
});
