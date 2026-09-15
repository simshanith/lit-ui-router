/**
 * @module
 * @mergeModuleWith <project>
 */
// The community `context-request` protocol, spoken rather than imported.
import type { UIRouter } from '@uirouter/core';

import type { UIRouterLit } from './core.js';
import type { UiView } from './ui-view.js';

/**
 * A context key branded with the type of the value it references, as the
 * [community context protocol](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md)
 * defines it. Structurally identical to `@lit/context`'s `Context`, so keys
 * cross between the two without a cast.
 *
 * @category types
 */
export type Context<KeyType, ValueType> = KeyType & {
  /** Phantom brand: the type of the value this key references. */
  __context__: ValueType;
};

/**
 * A context key whose value type is unknown — the protocol's `UnknownContext`.
 *
 * @category types
 */
export type UnknownContext = Context<unknown, unknown>;

/**
 * Extracts the value type a {@link Context} key carries.
 *
 * @category types
 */
export type ContextType<T extends UnknownContext> =
  T extends Context<infer _KeyType, infer ValueType> ? ValueType : never;

/**
 * The callback a requester hands a provider. A provider that was asked to
 * `subscribe` may call it again as the value changes, passing `unsubscribe`.
 *
 * @category types
 */
export type ContextCallback<ValueType> = (
  value: ValueType,
  unsubscribe?: () => void,
) => void;

/**
 * The shape a `context-request` event carries, whichever implementation
 * constructed it — what a provider reads.
 *
 * @category types
 */
export interface ContextRequest<T extends UnknownContext> {
  /** The requested context key, matched by identity (`===`). */
  readonly context: T;
  /** Invoked with the value when a provider can satisfy the request. */
  readonly callback: ContextCallback<ContextType<T>>;
  /** Whether the requester wants to be called again as the value changes. */
  readonly subscribe?: boolean;
}

/**
 * The protocol's event name.
 *
 * @category core
 */
export const contextRequestEventName = 'context-request' as const;

/**
 * The identity of {@link routerContext}: a plain object, so the key is unique
 * under `===` and readable in a debugger.
 *
 * @category types
 */
export interface RouterContextKey {
  /** Names the key for a debugger; identity, not this string, is what matches. */
  readonly name: 'lit-ui-router/context#router';
}

/**
 * The router context key's type — {@link RouterContextKey} branded with
 * {@link UIRouterLit}, so `@consume({ context: routerContext })` infers the
 * router.
 *
 * @category types
 */
export type RouterContext = Context<RouterContextKey, UIRouterLit>;

/**
 * The context key `<ui-router>` answers for: the router instance.
 *
 * Speaks the community `context-request` protocol without depending on
 * `@lit/context` — the key is a stable object, matched by identity, and the
 * branded type is the one `createContext()` would have produced. An element
 * written against `@lit/context` consumes it unchanged:
 *
 * @example
 * ```ts
 * import { consume } from '@lit/context';
 * import { routerContext } from 'lit-ui-router/context';
 * import type { UIRouterLit } from 'lit-ui-router';
 *
 * class MyElement extends LitElement {
 *   @consume({ context: routerContext })
 *   router!: UIRouterLit;
 * }
 * ```
 *
 * @see {@link requestRouter} for the dependency-free request
 * @see {@link UIRouterLitElement.seekRouter} for the house `ui-router-context` event
 *
 * @category core
 */
export const routerContext: RouterContext = Object.freeze({
  name: 'lit-ui-router/context#router',
}) as RouterContext;

/**
 * A `context-request` event for {@link routerContext}: bubbling, composed and
 * shaped as the protocol specifies, so any provider answers it.
 *
 * @category core
 */
export class RouterContextRequestEvent
  extends Event
  implements ContextRequest<RouterContext>
{
  /** Always {@link routerContext}. */
  readonly context: RouterContext = routerContext;
  /** Called by the provider with the router. */
  readonly callback: ContextCallback<UIRouterLit>;
  /** Whether later values are wanted. */
  readonly subscribe?: boolean;

  /**
   * @param callback - receives the router from whichever provider answers
   * @param subscribe - ask the provider to call back as the router changes
   */
  constructor(callback: ContextCallback<UIRouterLit>, subscribe?: boolean) {
    super(contextRequestEventName, { bubbles: true, composed: true });
    this.callback = callback;
    this.subscribe = subscribe;
  }
}

/**
 * Whether an event is a `context-request` for `key` — the guard a provider runs
 * before answering. The key is matched by identity, as the protocol specifies.
 *
 * @typeParam T - the context key's type, branded with the value it references
 * @param event - any event a provider's listener received
 * @param key - the context key this provider answers for
 *
 * @category core
 */
export const isContextRequest: <T extends UnknownContext>(
  event: Event,
  key: T,
) => event is Event & ContextRequest<T> = <T extends UnknownContext>(
  event: Event,
  key: T,
): event is Event & ContextRequest<T> => {
  const request = event as Partial<ContextRequest<T>>;
  return (
    event.type === contextRequestEventName &&
    request.context === key &&
    typeof request.callback === 'function'
  );
};

/**
 * Whether an event is a `context-request` for {@link routerContext} — the
 * router instance of {@link isContextRequest}.
 *
 * @param event - any event a provider's listener received
 *
 * @category core
 */
export const isRouterContextRequest: (
  event: Event,
) => event is Event & ContextRequest<RouterContext> = (
  event: Event,
): event is Event & ContextRequest<RouterContext> =>
  isContextRequest(event, routerContext);

/**
 * Options for {@link requestRouter}.
 *
 * @category types
 */
export interface RequestRouterOptions {
  /**
   * Ask the provider to keep calling back as the router changes; pair it with
   * {@link RequestRouterOptions.callback | callback}. `<ui-router>` answers
   * once and hands back a no-op unsubscribe, since it does not swap routers.
   */
  subscribe?: boolean;
  /**
   * Receives every answer, the synchronous first one included, with the
   * provider's `unsubscribe` when one was offered.
   */
  callback?: ContextCallback<UIRouterLit>;
}

/**
 * Requests the router from whichever provider answers on `target`, and returns
 * the value a provider supplied synchronously.
 *
 * The target is any `EventTarget`, not only an element. Returns `undefined`
 * when nobody answered.
 *
 * @param target - the event target to dispatch the request from
 * @param options - subscription and callback options
 *
 * @example
 * ```ts
 * import { requestRouter } from 'lit-ui-router/context';
 *
 * class MyElement extends LitElement {
 *   connectedCallback() {
 *     super.connectedCallback();
 *     this.router = requestRouter(this);
 *   }
 * }
 * ```
 *
 * @category core
 */
export const requestRouter: (
  target: EventTarget,
  options?: RequestRouterOptions,
) => UIRouterLit | undefined = (
  target: EventTarget,
  options: RequestRouterOptions = {},
): UIRouterLit | undefined => {
  let answer: UIRouterLit | undefined;
  let answered = false;
  target.dispatchEvent(
    new RouterContextRequestEvent((router, unsubscribe) => {
      if (!answered) {
        answered = true;
        answer = router;
      }
      options.callback?.(router, unsubscribe);
    }, options.subscribe),
  );
  return answer;
};

/**
 * Answers `context-request`s for `key` that reach `root`, so code with no
 * element of its own is still handed a value.
 *
 * The provider is the element-free twin of a provider element: it listens for
 * `context-request`, guards with {@link isContextRequest}, calls
 * `stopImmediatePropagation()` so an outer provider does not answer twice, and
 * delivers the value synchronously. A `subscribe: true` request gets a no-op
 * unsubscribe — the provider holds one value for its whole lifetime.
 *
 * `root` is any `EventTarget`. Under `@lit-labs/ssr` that is
 * `globalThis.litServerRoot`, the bottom of the renderer's event-target stack,
 * which every element event on the server reaches.
 *
 * Installing twice installs two listeners; the first one still wins, because it
 * stops immediate propagation. Uninstalling is exact — each call's returned
 * function removes only the listener that call added.
 *
 * @typeParam T - the context key's type, branded with the value it references
 * @param root - the event target requests travel to
 * @param key - the context key to answer for, matched by identity
 * @param value - the value to answer with, as the key's brand promises
 * @returns a function that uninstalls this provider
 *
 * @example
 * ```ts
 * import { provideContext, routerContext } from 'lit-ui-router/context';
 *
 * const uninstall = provideContext(globalThis.litServerRoot, routerContext, router);
 * try {
 *   // …render…
 * } finally {
 *   uninstall();
 * }
 * ```
 *
 * @category core
 */
export const provideContext: <T extends UnknownContext>(
  root: EventTarget,
  key: T,
  value: ContextType<T>,
) => () => void = <T extends UnknownContext>(
  root: EventTarget,
  key: T,
  value: ContextType<T>,
): (() => void) => {
  const listener = (event: Event): void => {
    if (!isContextRequest(event, key)) return;
    event.stopImmediatePropagation();
    event.callback(value, event.subscribe ? () => {} : undefined);
  };
  root.addEventListener(contextRequestEventName, listener);
  return () => root.removeEventListener(contextRequestEventName, listener);
};

/**
 * {@link provideContext} bound to {@link routerContext}: the element-free twin
 * of `<ui-router>`, answering router requests that reach `root`.
 *
 * The parameter is `UIRouterLit`, not `UIRouter`, because the key this answers
 * is branded with `UIRouterLit`, and a provider may only answer with the value
 * its key promises. The slot ({@link withRouterSync | `withRouterSync`}) takes
 * either.
 *
 * @param root - the event target requests travel to
 * @param router - the router to answer with
 * @returns a function that uninstalls this provider
 *
 * @example
 * ```ts
 * import { provideRouter } from 'lit-ui-router/context';
 *
 * const uninstall = provideRouter(globalThis.litServerRoot, router);
 * try {
 *   // …render…
 * } finally {
 *   uninstall();
 * }
 * ```
 *
 * @see {@link withRouterSync} for the slot the same render sets instead
 *
 * @category core
 */
export const provideRouter: (
  root: EventTarget,
  router: UIRouterLit,
) => () => void = (root: EventTarget, router: UIRouterLit): (() => void) =>
  provideContext(root, routerContext, router);

/**
 * The event name a waking `<ui-view>` offers itself under.
 *
 * @category types
 */
export const uiViewProvidedEventName = 'ui-view-provided' as const;

/**
 * The event a waking `<ui-view>` dispatches to offer itself: bubbling, composed
 * and cancelable, so a consumer under any root above it can take the view by
 * calling `preventDefault()`.
 *
 * @category types
 */
export class UiViewProvidedEvent extends Event {
  /** The view offering itself. */
  readonly view: UiView;

  /**
   * @param view - the view offering itself
   */
  constructor(view: UiView) {
    super(uiViewProvidedEventName, {
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    this.view = view;
  }
}

/**
 * Offers `view` to whichever consumer listens above it, and reports whether one
 * took it.
 *
 * @param view - the view offering itself
 * @returns `true` when a consumer took the view
 *
 * @category core
 */
export const provideUiView: (view: UiView) => boolean = (
  view: UiView,
): boolean => !view.dispatchEvent(new UiViewProvidedEvent(view));

/**
 * Takes every `<ui-view>` offered under `root`, so a hydration client adopts
 * the nodes a waking view holds.
 *
 * Each offer is marked taken and stopped, so an outer consumer does not take it
 * a second time. The view is marked taken before `take` runs: a throwing `take`
 * still counts as taken, and the caller owns its fallback.
 *
 * @param root - the event target offers travel to
 * @param take - receives each view offered under `root`
 * @returns a function that uninstalls this consumer
 *
 * @example
 * ```ts
 * import { consumeUiViews } from 'lit-ui-router/context';
 *
 * const release = consumeUiViews(document, (view) => hydrate(view));
 * try {
 *   document.querySelectorAll('[defer-hydration]').forEach((el) =>
 *     el.removeAttribute('defer-hydration'),
 *   );
 * } finally {
 *   release();
 * }
 * ```
 *
 * @category core
 */
export const consumeUiViews: (
  root: EventTarget,
  take: (view: UiView) => void,
) => () => void = (
  root: EventTarget,
  take: (view: UiView) => void,
): (() => void) => {
  const listener = (event: Event): void => {
    const offer = event as UiViewProvidedEvent;
    offer.preventDefault();
    offer.stopImmediatePropagation();
    take(offer.view);
  };
  root.addEventListener(uiViewProvidedEventName, listener);
  return () => root.removeEventListener(uiViewProvidedEventName, listener);
};

/** The call-scoped router. A plain module slot, never an async context. */
let scoped: UIRouter | undefined;

/**
 * Returns the router the innermost enclosing
 * {@link withRouterSync | `withRouterSync`} call scoped, or `undefined`
 * outside one.
 *
 * @category core
 */
export const getScopedRouter: () => UIRouter | undefined = ():
  | UIRouter
  | undefined => scoped;

/**
 * Runs `run` with `router` published to {@link getScopedRouter | `getScopedRouter`},
 * restoring whatever was there before — `undefined` included — when it returns
 * or throws.
 *
 * This is the tree-less provider. A `context-request` needs a tree to bubble
 * through, which is what {@link provideRouter | `provideRouter`} serves;
 * `withRouterSync` publishes a router for one synchronous call instead, so code
 * with no element — a server render, a test — asks `getScopedRouter()`.
 *
 * The `Sync` suffix names the constraint the thenable guard enforces, in the
 * convention of `collectResultSync`. `@lit-labs/ssr`'s `render()` returns a
 * sync generator, so a whole render happens inside `run` as long as the caller
 * consumes it there: `collectResultSync(render(template))`. Nothing is detected
 * and nothing is upgraded — if `run` returns a thenable the slot is restored
 * and a `TypeError` is thrown, because anything that promise does later reads a
 * slot that is already gone.
 *
 * Calls nest: an inner call sees its own router, and the outer one is restored
 * on the way out.
 *
 * The router is any `@uirouter/core` `UIRouter`: the directives that read the
 * slot want `stateService`, `stateRegistry`, `transitionService` and `globals`,
 * none of which `UIRouterLit` adds, so a caller that types its router as
 * `UIRouter` — the type `UIViewInjectedProps.router` declares — passes it here
 * unchanged.
 *
 * @typeParam T - whatever `run` returns
 * @param router - the router to publish for the duration of `run`
 * @param run - the call the router is scoped to, consumed synchronously
 * @returns whatever `run` returned
 * @throws a `TypeError` if `run` returns a thenable
 *
 * @example
 * ```ts
 * import { render } from '@lit-labs/ssr';
 * import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
 * import { withRouterSync } from 'lit-ui-router/context';
 *
 * const markup = withRouterSync(router, () =>
 *   collectResultSync(render(html`<my-page></my-page>`)),
 * );
 * ```
 *
 * @category core
 */
export const withRouterSync: <T>(router: UIRouter, run: () => T) => T = <T>(
  router: UIRouter,
  run: () => T,
): T => {
  const previous = scoped;
  scoped = router;
  let result: T;
  try {
    result = run();
  } finally {
    scoped = previous;
  }
  if (typeof (result as { then?: unknown } | undefined)?.then === 'function') {
    throw new TypeError(
      'withRouterSync() is synchronous: `run` returned a thenable, and the router slot is already restored by the time it settles. Consume the render inside `run` — collectResultSync(render(template)) — or read the router before awaiting.',
    );
  }
  return result;
};
