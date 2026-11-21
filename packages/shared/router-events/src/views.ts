// Reads core's view service through `viewService._pluginapi`, which core types `@internal`.
import type { ActiveUIView, UIRouter, ViewConfig } from '@uirouter/core';
import type { ViewFill, ViewInfo, ViewsEvent } from './event-schema.ts';

type Draft = Omit<ViewsEvent, 'v' | 'seq' | 't'>;

// Every target runtime has it; declared here so the module compiles without DOM or node types.
declare function queueMicrotask(callback: () => void): void;

// `component` is the renderers' own declaration property, which core's view declaration does not declare.
const componentOf = ({ viewDecl }: ViewConfig): string | undefined => {
  const component: unknown =
    'component' in viewDecl ? viewDecl.component : undefined;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- a renderer declares a component by name or as a class or function
  if (typeof component === 'string') return component || undefined;

  return component instanceof Function
    ? component.name || undefined
    : undefined;
};

const fillOf = (config: ViewConfig): ViewFill => {
  const decl = config.viewDecl;
  const component = componentOf(config);

  return {
    state: decl.$context?.name ?? '',
    view: decl.$name ?? '$default',
    target: {
      name: decl.$uiViewName ?? '$default',
      anchor: decl.$uiViewContextAnchor ?? '',
    },
    ...(component !== undefined && { component }),
  };
};

const viewOf = (
  view: ActiveUIView,
  config: ViewConfig | undefined,
): ViewInfo => ({
  id: view.id,
  name: view.name,
  fqn: view.fqn,
  type: view.$type,
  context: view.creationContext.name ?? '',
  fill: config ? fillOf(config) : null,
});

/**
 * Reads the router's `ui-view`s each time core syncs them, and once at the start; sends a snapshot when it changed.
 * The read waits a microtask, so a view its parent's update removed without a sync is gone from it.
 */
export const observeViews = (
  router: UIRouter,
  send: (draft: Draft) => void,
): (() => void) => {
  const api = router.viewService._pluginapi;
  // What the last sync paired; a view registered before the first one keeps the config it reports, while active.
  let paired = new Map<ActiveUIView, ViewConfig | undefined>();
  let left: ViewConfig[] | undefined;
  let queued = false;
  let stopped = false;
  let last = '';

  const read = () => {
    queued = false;

    if (stopped) return;

    const active = api._activeViewConfigs();
    const registered = api._registeredUIViews();

    const configOf = (view: ActiveUIView) => {
      const config = paired.has(view) ? paired.get(view) : view.config;

      return config && active.includes(config) ? config : undefined;
    };

    const taken = new Set(registered.map(configOf));

    const draft: Draft = {
      type: 'views',
      views: registered
        .map((view) => viewOf(view, configOf(view)))
        .sort((a, b) => a.id - b.id),
      unmatched: (left ?? active)
        .filter((config) => active.includes(config) && !taken.has(config))
        .map(fillOf),
    };

    const key = JSON.stringify(draft);

    if (key === last) return;
    last = key;
    send(draft);
  };

  const stop = api._onSync((tuples) => {
    paired = new Map(
      tuples.flatMap(({ uiView, viewConfig }) =>
        uiView ? [[uiView, viewConfig] as const] : [],
      ),
    );
    left = tuples.flatMap(({ uiView, viewConfig }) =>
      uiView ? [] : [viewConfig],
    );

    if (queued) return;
    queued = true;
    queueMicrotask(read);
  });

  read();

  return () => {
    stopped = true;
    // SAFETY: core types the deregistration as Function; it takes no arguments
    (stop as () => void)();
  };
};
