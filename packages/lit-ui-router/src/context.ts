// The community `context-request` protocol, spoken rather than imported.
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
 * Whether an event is a `context-request` for {@link routerContext} — the
 * guard a provider runs before answering.
 *
 * @param event - any event a provider's listener received
 *
 * @category core
 */
export const isRouterContextRequest: (
  event: Event,
) => event is Event & ContextRequest<RouterContext> = (
  event: Event,
): event is Event & ContextRequest<RouterContext> => {
  const request = event as Partial<ContextRequest<RouterContext>>;
  return (
    event.type === contextRequestEventName &&
    request.context === routerContext &&
    typeof request.callback === 'function'
  );
};

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
