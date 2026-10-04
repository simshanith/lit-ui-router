// The subscribe half of the router context: a provider's provisional router, and the one upgrade it may make.
import { isRouterContextRequest, requestRouter } from './context.js';
import type { UIRouterLit } from './core.js';
import { uiRouterContextEventName } from './events.js';
import type { UiRouterContextEvent } from './events.js';

/** The unsubscribe a provider hands out when its router is final: it will not call again. */
export const noUnsubscribe = (): void => {};

/**
 * The `subscribe: true` requests a provider answered while its router was
 * provisional, each owed the router that replaces it.
 *
 * @internal
 */
export class RouterSubscribers {
  private readonly pending = new Set<(router: UIRouterLit) => void>();

  /**
   * Answers a router `context-request`. A subscriber is kept, with an
   * unsubscribe that drops it, only while `provisional`; otherwise it gets
   * {@link noUnsubscribe}.
   */
  answer(
    event: Event,
    router: UIRouterLit | undefined,
    provisional: boolean,
  ): void {
    if (!router || !isRouterContextRequest(event)) {
      return;
    }
    // stopped first: a throwing consumer must not leak the request outward
    event.stopImmediatePropagation();
    const { callback, subscribe } = event;
    if (!subscribe) {
      return callback(router);
    }
    if (!provisional) {
      return callback(router, noUnsubscribe);
    }
    const deliver = (next: UIRouterLit) => callback(next, noUnsubscribe);
    this.pending.add(deliver);
    callback(router, () => this.pending.delete(deliver));
  }

  /** Hands every kept subscriber `router`, once, and forgets them. */
  deliver(router: UIRouterLit): void {
    for (const deliver of [...this.pending]) {
      // An earlier subscriber may have disconnected this one, unsubscribing it.
      if (!this.pending.delete(deliver)) {
        continue;
      }
      try {
        deliver(router);
      } catch (thrown) {
        queueMicrotask(() => {
          throw thrown;
        });
      }
    }
  }
}

/**
 * What {@link subscribeRouter} found: the router, and the unsubscribe to call
 * on disconnect, absent when the provider's router is final.
 *
 * @internal
 */
export interface RouterSubscription {
  router: UIRouterLit | undefined;
  unsubscribe: (() => void) | undefined;
}

/**
 * Seeks the router from `target` and subscribes to its replacement, which
 * reaches `onReplaced`.
 *
 * Asks over `context-request` with `subscribe: true`, falling back to the house
 * `ui-router-context` event, which cannot subscribe, when nobody answered.
 *
 * @internal
 */
export const subscribeRouter = (
  target: Element,
  onReplaced: (router: UIRouterLit) => void,
): RouterSubscription => {
  let seeking = true;
  let unsubscribe: (() => void) | undefined;
  const router = requestRouter(target, {
    subscribe: true,
    callback: (value, offered) => {
      unsubscribe = offered === noUnsubscribe ? undefined : offered;
      if (!seeking) {
        onReplaced(value);
      }
    },
  });
  seeking = false;
  if (router) {
    return { router, unsubscribe };
  }
  const event: UiRouterContextEvent = new CustomEvent(
    uiRouterContextEventName,
    { bubbles: true, composed: true, detail: {} },
  );
  target.dispatchEvent(event);
  return { router: event.detail.uiRouter, unsubscribe: undefined };
};
