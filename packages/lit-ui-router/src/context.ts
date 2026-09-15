/**
 * @module
 * @mergeModuleWith <project>
 */
// The community `context-request` protocol, spoken rather than imported.
import type { UIRouter } from '@uirouter/core';
import type { RenderOptions } from 'lit';

import type { UIRouterLit } from './core.js';

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
 * A `context-request` event for any key: bubbling, composed and shaped as the
 * protocol specifies, so any provider answers it.
 *
 * @typeParam T - the context key's type, branded with the value it references
 *
 * @category core
 */
export class ContextRequestEvent<T extends UnknownContext>
  extends Event
  implements ContextRequest<T>
{
  /** The key this request is for, matched by identity. */
  readonly context: T;
  /** Called by the provider with the value. */
  readonly callback: ContextCallback<ContextType<T>>;
  /** Whether later values are wanted. */
  readonly subscribe?: boolean;

  /**
   * @param context - the context key to request
   * @param callback - receives the value from whichever provider answers
   * @param subscribe - ask the provider to call back as the value changes
   */
  constructor(
    context: T,
    callback: ContextCallback<ContextType<T>>,
    subscribe?: boolean,
  ) {
    super(contextRequestEventName, { bubbles: true, composed: true });
    this.context = context;
    this.callback = callback;
    this.subscribe = subscribe;
  }
}

/**
 * A `context-request` event for {@link routerContext} — the router instance of
 * {@link ContextRequestEvent}.
 *
 * @category core
 */
export class RouterContextRequestEvent extends ContextRequestEvent<RouterContext> {
  /**
   * @param callback - receives the router from whichever provider answers
   * @param subscribe - ask the provider to call back as the router changes
   */
  constructor(callback: ContextCallback<UIRouterLit>, subscribe?: boolean) {
    super(routerContext, callback, subscribe);
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
 * Options for {@link requestContext}.
 *
 * @typeParam T - the context key's type, branded with the value it references
 *
 * @category types
 */
export interface RequestContextOptions<T extends UnknownContext> {
  /**
   * Ask the provider to keep calling back as the value changes; pair it with
   * {@link RequestContextOptions.callback | callback}. A provider that holds
   * one value answers once and hands back a no-op unsubscribe.
   */
  subscribe?: boolean;
  /**
   * Receives every answer, the synchronous first one included, with the
   * provider's `unsubscribe` when one was offered.
   */
  callback?: ContextCallback<ContextType<T>>;
}

/**
 * Options for {@link requestRouter} — the router instance of
 * {@link RequestContextOptions}.
 *
 * @category types
 */
export type RequestRouterOptions = RequestContextOptions<RouterContext>;

/**
 * Requests `key` from whichever provider answers on `target`, and returns the
 * value a provider supplied synchronously.
 *
 * The target is any `EventTarget`, not only an element. Returns `undefined`
 * when nobody answered. Every answer reaches
 * {@link RequestContextOptions.callback | options.callback}; the return value
 * is the first one only.
 *
 * @typeParam T - the context key's type, branded with the value it references
 * @param target - the event target to dispatch the request from
 * @param key - the context key to request, matched by identity
 * @param options - subscription and callback options
 *
 * @example
 * ```ts
 * import { requestContext, routerContext } from 'lit-ui-router/context';
 *
 * const router = requestContext(element, routerContext);
 * ```
 *
 * @category core
 */
export const requestContext: <T extends UnknownContext>(
  target: EventTarget,
  key: T,
  options?: RequestContextOptions<T>,
) => ContextType<T> | undefined = <T extends UnknownContext>(
  target: EventTarget,
  key: T,
  options: RequestContextOptions<T> = {},
): ContextType<T> | undefined => {
  let answer: ContextType<T> | undefined;
  let answered = false;
  target.dispatchEvent(
    new ContextRequestEvent<T>(
      key,
      (value, unsubscribe) => {
        if (!answered) {
          answered = true;
          answer = value;
        }
        options.callback?.(value, unsubscribe);
      },
      options.subscribe,
    ),
  );
  return answer;
};

/**
 * Requests the router from whichever provider answers on `target`, and returns
 * the value a provider supplied synchronously — the router instance of
 * {@link requestContext}.
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
): UIRouterLit | undefined => requestContext(target, routerContext, options);

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
 * The identity of {@link adoptUiViewContext}: a plain object, so the key is
 * unique under `===` and readable in a debugger.
 *
 * @category types
 */
export interface AdoptUiViewContextKey {
  /** Names the key for a debugger; identity, not this string, is what matches. */
  readonly name: 'lit-ui-router/context#adopt-ui-view';
}

/**
 * The waking `<ui-view>` as an adopter sees it: the element holding the
 * served nodes, with the template and render options a hydrate reads.
 *
 * @category types
 */
export interface AdoptableView extends HTMLElement {
  /** The routed template the served nodes came from. */
  render(): unknown;
  /** The options the view renders with, which the hydrate reads too. */
  readonly renderOptions: RenderOptions;
}

/**
 * The adopt-view context key's type — {@link AdoptUiViewContextKey} branded
 * with the adopter function, so `@consume({ context: adoptUiViewContext })`
 * infers it.
 *
 * @category types
 */
export type AdoptUiViewContext = Context<
  AdoptUiViewContextKey,
  (view: AdoptableView) => void
>;

/**
 * The context key a hydration client answers for, under the container it
 * hydrates, with the function that adopts a waking `<ui-view>`'s held nodes.
 *
 * The view requests it once on its waking update, after re-seeking its router,
 * and calls what it gets. Unanswered, the view drops the held nodes and warns.
 *
 * A client with no element of its own provides it with
 * {@link provideContext | `provideContext(container, adoptUiViewContext, adopt)`};
 * an element provides it with `@provide` from `@lit/context`, since the key is
 * the one `createContext()` would have produced.
 *
 * @example
 * ```ts
 * import { adoptUiViewContext, provideContext } from 'lit-ui-router/context';
 *
 * const uninstall = provideContext(container, adoptUiViewContext, (view) =>
 *   hydrate(view),
 * );
 * try {
 *   container
 *     .querySelectorAll('[defer-hydration]')
 *     .forEach((el) => el.removeAttribute('defer-hydration'));
 * } finally {
 *   uninstall();
 * }
 * ```
 *
 * @category core
 */
export const adoptUiViewContext: AdoptUiViewContext = Object.freeze({
  name: 'lit-ui-router/context#adopt-ui-view',
}) as AdoptUiViewContext;

/**
 * The identity of {@link parentUiViewContext}: a plain object, so the key is
 * unique under `===` and readable in a debugger.
 *
 * @category types
 */
export interface ParentUiViewContextKey {
  /** Names the key for a debugger; identity, not this string, is what matches. */
  readonly name: 'lit-ui-router/context#parent-ui-view';
}

/**
 * The parent-view context key's type — {@link ParentUiViewContextKey} branded
 * with {@link UiView}, so `@consume({ context: parentUiViewContext })` infers
 * the view.
 *
 * @category types
 */
export type ParentUiViewContext = Context<ParentUiViewContextKey, UiView>;

/**
 * The context key every `<ui-view>` answers for, with itself, so a descendant
 * finds its enclosing view.
 *
 * A `<ui-view>` seeks its own parent over the house `ui-view-context` event;
 * this key is the protocol form of that answer, for everyone else. The nearest
 * enclosing view wins, and no view answers its own request.
 *
 * @example
 * ```ts
 * import { consume } from '@lit/context';
 * import { parentUiViewContext } from 'lit-ui-router/context';
 * import type { UiView } from 'lit-ui-router';
 *
 * class MyElement extends LitElement {
 *   @consume({ context: parentUiViewContext })
 *   parentView!: UiView;
 * }
 * ```
 *
 * @example
 * ```ts
 * import { parentUiViewContext, requestContext } from 'lit-ui-router/context';
 *
 * const parentView = requestContext(element, parentUiViewContext);
 * ```
 *
 * @category core
 */
export const parentUiViewContext: ParentUiViewContext = Object.freeze({
  name: 'lit-ui-router/context#parent-ui-view',
}) as ParentUiViewContext;

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
