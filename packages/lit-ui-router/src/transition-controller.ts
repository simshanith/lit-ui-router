import {
  HookMatchCriteria,
  HookResult,
  RawParams,
  StateDeclaration,
  StateOrName,
  Transition,
  UIRouter,
  UIRouterGlobals,
} from '@uirouter/core';
import { ReactiveController, ReactiveControllerHost } from 'lit';

import { subscribeRouter } from './router-subscription.js';

/** @internal */
type DeregisterFn = () => void;

/**
 * Transition lifecycle events that a {@link TransitionController} can observe.
 *
 * Each value corresponds to a
 * {@link "@uirouter/core"!IHookRegistry | TransitionService hook registry}
 * method of the same name.
 *
 * @category controllers
 */
export type TransitionEventType =
  | 'onBefore'
  | 'onStart'
  | 'onSuccess'
  | 'onError';

/**
 * The reason a {@link TransitionController} invoked its callback.
 *
 * Either one of the observed {@link TransitionEventType} hooks fired, or the
 * host element (re)connected to the DOM and the controller synchronized
 * with the router's current state (`'hostConnected'`).
 *
 * @category controllers
 */
export type TransitionCallbackReason = TransitionEventType | 'hostConnected';

/**
 * A callback invoked by {@link TransitionController} whenever the host is
 * synchronized with the router.
 *
 * For `'onBefore'` and `'onStart'` reasons, the returned value is passed
 * back to UI-Router as a
 * {@link HookResult},
 * so the callback may cancel or redirect the pending transition.
 *
 * @param transition - The {@link Transition} which triggered the callback.
 *   For the `'hostConnected'` reason this is the most recent successful
 *   transition, or `undefined` when no transition has succeeded yet.
 * @param reason - Why the callback was invoked (see {@link TransitionCallbackReason}).
 *
 * @category controllers
 */
export type TransitionCallback = (
  transition: Transition | undefined,
  reason: TransitionCallbackReason,
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- public callback type; narrowing it rejects existing callbacks
) => unknown;

/**
 * Options for {@link TransitionController}.
 *
 * @category controllers
 */
export interface TransitionControllerOptions {
  /**
   * The {@link UIRouter} instance to observe.
   *
   * When omitted, the controller discovers the router from an ancestor
   * <code>&lt;ui-router&gt;</code> (or <code>&lt;ui-view&gt;</code>) each time
   * the host connects, and follows the placeholder router a
   * <code>&lt;ui-router&gt;</code> mints for itself to the one that replaces
   * it, synchronizing again with the `'hostConnected'` reason.
   */
  router?: UIRouter;

  /**
   * {@link HookMatchCriteria}
   * limiting which transitions notify the host.
   *
   * Defaults to `{}` (all transitions).
   */
  criteria?: HookMatchCriteria;

  /**
   * The transition lifecycle events to observe.
   *
   * Defaults to `['onSuccess']`.
   */
  events?: TransitionEventType[];

  /**
   * Invoked before `host.requestUpdate()` whenever an observed event fires,
   * and once each time the host connects (see {@link TransitionCallbackReason}).
   */
  callback?: TransitionCallback;
}

/**
 * A zero-dependency Lit
 * {@link https://lit.dev/docs/composition/controllers/ | ReactiveController}
 * that keeps its host element synchronized with UI-Router transitions.
 *
 * The controller registers {@link "@uirouter/core"!TransitionService | TransitionService} hooks (by default
 * `onSuccess`) when the host connects and calls `host.requestUpdate()`
 * whenever a matching transition event fires — no manual `requestUpdate()`
 * plumbing, no leaked hooks. All registered hooks are deregistered in
 * `hostDisconnected()`, so the controller is garbage-collection safe for
 * elements that come and go from the DOM (including `sticky` routed
 * components).
 *
 * On (re)connect the controller also synchronizes once with the router's
 * current state, so hosts render fresh data even when they connect after
 * a transition has already completed.
 *
 * @example Re-render on every successful transition
 * ```ts
 * class NavHeader extends LitElement {
 *   private transitions = new TransitionController(this);
 *
 *   render() {
 *     // Re-evaluated after every successful transition
 *     return html`Current state: ${this.transitions.current?.name}`;
 *   }
 * }
 * ```
 *
 * @example React to parameter changes on a specific state
 * ```ts
 * class UserDetail extends LitElement {
 *   private transitions = new TransitionController(this, {
 *     criteria: { to: 'users.detail' },
 *     callback: () => this.loadUser(this.transitions.params.userId),
 *   });
 * }
 * ```
 *
 * @example With an explicit router instance
 * ```ts
 * const controller = new TransitionController(host, { router });
 * ```
 *
 * @category controllers
 */
export class TransitionController implements ReactiveController {
  private readonly host: ReactiveControllerHost & Element;

  private readonly options: TransitionControllerOptions;

  private readonly deregisterFns: DeregisterFn[] = [];

  /** drops the subscription to a provider that may still replace its router */
  private unsubscribe?: DeregisterFn;

  private _router?: UIRouter;

  private _transition?: Transition;

  constructor(
    host: ReactiveControllerHost & Element,
    options: TransitionControllerOptions = {},
  ) {
    this.host = host;
    this.options = options;
    this._router = options.router;
    host.addController(this);
  }

  /**
   * The observed {@link UIRouter} instance.
   *
   * `undefined` until provided via {@link TransitionControllerOptions.router} or
   * discovered from an ancestor <code>&lt;ui-router&gt;</code> on connect.
   */
  get router(): UIRouter | undefined {
    return this._router;
  }

  /** The router's {@link UIRouterGlobals}, if a router has been discovered. */
  get globals(): UIRouterGlobals | undefined {
    return this._router?.globals;
  }

  /** The current parameter values (`globals.params`). */
  get params(): RawParams {
    return this.globals?.params ?? {};
  }

  /** The current {@link StateDeclaration} (`globals.current`). */
  get current(): StateDeclaration | undefined {
    return this.globals?.current;
  }

  /**
   * The most recent {@link Transition} observed by this controller
   * (set by observed events and on host connect).
   */
  get transition(): Transition | undefined {
    return this._transition;
  }

  /**
   * Delegates to {@link "@uirouter/core"!StateService.includes | StateService.includes}: is the state (or glob pattern,
   * e.g. `'admin.**'`) included in the current active state?
   *
   * Returns `false` when no router has been discovered.
   */
  includes(stateOrName: StateOrName, params?: RawParams): boolean {
    return this._router?.stateService.includes(stateOrName, params) ?? false;
  }

  /** @internal */
  hostConnected(): void {
    if (!this.options.router) {
      const { router, unsubscribe } = subscribeRouter(
        this.host,
        this.onRouterReplaced,
      );

      // A reconnect outside any provider keeps the router it had.
      this._router = router ?? this._router;
      this.unsubscribe = unsubscribe;
    }

    this.watch();
  }

  /** @internal */
  hostDisconnected(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.unwatch();
  }

  private watch(): void {
    const router = this._router;

    if (!router) {
      return;
    }

    const criteria = this.options.criteria ?? {};
    const events = this.options.events ?? ['onSuccess'];

    for (const event of events) {
      // SAFETY: hook registration returns its deregistration function
      this.deregisterFns.push(
        router.transitionService[event](criteria, (transition) =>
          this.notify(transition, event),
        ) as DeregisterFn,
      );
    }

    // Synchronize with the router's current state: the host may have
    // (re)connected after the transition that put it on screen succeeded.
    void this.notify(
      router.globals.successfulTransitions.peekTail(),
      'hostConnected',
    );
  }

  private unwatch(): void {
    while (this.deregisterFns.length) {
      this.deregisterFns.shift()?.();
    }
  }

  /** What a disconnect and reconnect would do, for the router that replaced the one found. */
  private readonly onRouterReplaced = (router: UIRouter): void => {
    this.unsubscribe = undefined;
    this.unwatch();
    this._router = router;
    this._transition = undefined;
    this.watch();
  };

  private notify(
    transition: Transition | undefined,
    reason: TransitionCallbackReason,
  ): HookResult {
    this._transition = transition ?? this._transition;
    const result = this.options.callback?.(transition, reason);
    this.host.requestUpdate();

    // SAFETY: ui-router acts only on false, a TargetState or a promise; any other value continues
    return result as HookResult;
  }
}
