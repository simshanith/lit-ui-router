// Context discovery over DOM events; element classes are types only, so this module stays registration-free.
import type { UIRouterLit } from './core.js';
import type { UiView } from './ui-view.js';

/**
 * Event name used to discover the enclosing router context.
 * @internal
 */
export const UI_ROUTER_CONTEXT_EVENT = 'ui-router-context';

/**
 * Event name used to discover the enclosing <code>&lt;ui-view&gt;</code>.
 * @internal
 */
export const UI_VIEW_CONTEXT_EVENT = 'ui-view-context';

interface UiRouterContextEventDetail {
  uiRouter?: UIRouterLit;
}

/**
 * @internal
 */
export type UiRouterContextEvent = CustomEvent<UiRouterContextEventDetail>;

interface UiViewContextEventDetail {
  parentView: UiView | null;
}

/**
 * @internal
 */
export type UiViewContextEvent = CustomEvent<UiViewContextEventDetail>;

/** @internal */
export function uiRouterContextEvent(
  uiRouter?: UIRouterLit,
): UiRouterContextEvent {
  return new CustomEvent(UI_ROUTER_CONTEXT_EVENT, {
    bubbles: true,
    composed: true,
    detail: {
      uiRouter,
    },
  });
}

/** @internal */
export function onUiRouterContextEvent(uiRouter?: UIRouterLit) {
  return (event: UiRouterContextEvent) => {
    event.stopPropagation();
    event.detail.uiRouter = uiRouter;
  };
}

/**
 * Discovers the {@link UIRouterLit} instance provided by the nearest
 * enclosing <code>&lt;ui-router&gt;</code> element.
 *
 * Dispatches a bubbling, composed <code>ui-router-context</code> event from
 * the candidate element; the enclosing <code>&lt;ui-router&gt;</code>
 * answers it with its router instance. Returns <code>undefined</code> when
 * the candidate is not inside a <code>&lt;ui-router&gt;</code> (e.g. not
 * yet connected).
 *
 * This is the dependency-injection primitive for integrating external
 * reactivity systems (state stores, controllers) with the router context —
 * call it from <code>hostConnected()</code> / <code>connectedCallback()</code>
 * instead of prop-drilling the router instance.
 *
 * Also available as {@link UIRouterLitElement.seekRouter}; this standalone
 * form is importable from <code>lit-ui-router/pure</code> without registering
 * the custom elements.
 *
 * @category core
 */
export function seekRouter(candidate: Element): UIRouterLit | undefined {
  const event = uiRouterContextEvent();
  candidate.dispatchEvent(event);
  return event.detail.uiRouter;
}

/** @internal */
export function uiViewContextEvent(): UiViewContextEvent {
  return new CustomEvent(UI_VIEW_CONTEXT_EVENT, {
    bubbles: true,
    composed: true,
    detail: {
      parentView: null,
    },
  });
}

/** @internal */
export function seekParentView(candidate: Element): UiView | null {
  const event = uiViewContextEvent();
  candidate.dispatchEvent(event);
  return event.detail.parentView;
}
