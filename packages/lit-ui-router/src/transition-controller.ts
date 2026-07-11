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

import { UIRouterLitElement } from './ui-router.js';

/** @internal */
type DeregisterFn = () => void;

/**
 * Transition lifecycle events that a [[TransitionController]] can observe.
 *
 * Each value corresponds to a
 * {@link https://ui-router.github.io/core/docs/latest/interfaces/_transition_interface_.ihookregistry.html | TransitionService hook registry}
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
 * The reason a [[TransitionController]] invoked its callback.
 *
 * Either one of the observed [[TransitionEventType]] hooks fired, or the
 * host element (re)connected to the DOM and the controller synchronized
 * with the router's current state (`'hostConnected'`).
 *
 * @category controllers
 */
export type TransitionCallbackReason = TransitionEventType | 'hostConnected';

/**
 * A callback invoked by [[TransitionController]] whenever the host is
 * synchronized with the router.
 *
 * For `'onBefore'` and `'onStart'` reasons, the returned value is passed
 * back to UI-Router as a
 * {@link https://ui-router.github.io/core/docs/latest/modules/_transition_interface_.html#hookresult | HookResult},
 * so the callback may cancel or redirect the pending transition.
 *
 * @param transition - The [[Transition]] which triggered the callback.
 *   For the `'hostConnected'` reason this is the most recent successful
 *   transition, or `undefined` when no transition has succeeded yet.
 * @param reason - Why the callback was invoked (see [[TransitionCallbackReason]]).
 *
 * @category controllers
 */
export type TransitionCallback = (
  transition: Transition | undefined,
  reason: TransitionCallbackReason,
) => unknown;

/**
 * Options for [[TransitionController]].
 *
 * @category controllers
 */
export interface TransitionControllerOptions {
  /**
   * The [[UIRouter]] instance to observe.
   *
   * When omitted, the controller discovers the router from an ancestor
   * <code>&lt;ui-router&gt;</code> (or <code>&lt;ui-view&gt;</code>) via the
   * `ui-router-context` event when the host connects.
   */
  router?: UIRouter;

  /**
   * {@link https://ui-router.github.io/core/docs/latest/interfaces/_transition_interface_.hookmatchcriteria.html | HookMatchCriteria}
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
   * and once each time the host connects (see [[TransitionCallbackReason]]).
   */
  callback?: TransitionCallback;
}

/**
 * A zero-dependency Lit
 * {@link https://lit.dev/docs/composition/controllers/ | ReactiveController}
 * that keeps its host element synchronized with UI-Router transitions.
 *
 * The controller registers [[TransitionService]] hooks (by default
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
   * The observed [[UIRouter]] instance.
   *
   * `undefined` until provided via [[TransitionControllerOptions.router]] or
   * discovered from an ancestor <code>&lt;ui-router&gt;</code> on connect.
   */
  get router(): UIRouter | undefined {
    return this._router;
  }

  /** The router's [[UIRouterGlobals]], if a router has been discovered. */
  get globals(): UIRouterGlobals | undefined {
    return this._router?.globals;
  }

  /** The current parameter values (`globals.params`). */
  get params(): RawParams {
    return this.globals?.params ?? {};
  }

  /** The current [[StateDeclaration]] (`globals.current`). */
  get current(): StateDeclaration | undefined {
    return this.globals?.current;
  }

  /**
   * The most recent [[Transition]] observed by this controller
   * (set by observed events and on host connect).
   */
  get transition(): Transition | undefined {
    return this._transition;
  }

  /**
   * Delegates to [[StateService.includes]]: is the state (or glob pattern,
   * e.g. `'admin.**'`) included in the current active state?
   *
   * Returns `false` when no router has been discovered.
   */
  includes(stateOrName: StateOrName, params?: RawParams): boolean {
    return this._router?.stateService.includes(stateOrName, params) ?? false;
  }

  /** @internal */
  hostConnected() {
    this._router ??=
      this.options.router ?? UIRouterLitElement.seekRouter(this.host);

    const router = this._router;
    if (!router) {
      return;
    }

    const criteria = this.options.criteria ?? {};
    const events = this.options.events ?? ['onSuccess'];

    for (const event of events) {
      this.deregisterFns.push(
        router.transitionService[event](
          criteria,
          (transition) => this.notify(transition, event) as HookResult,
        ) as DeregisterFn,
      );
    }

    // Synchronize with the router's current state: the host may have
    // (re)connected after the transition that put it on screen succeeded.
    this.notify(
      router.globals.successfulTransitions.peekTail(),
      'hostConnected',
    );
  }

  /** @internal */
  hostDisconnected() {
    while (this.deregisterFns.length) {
      this.deregisterFns.shift()?.();
    }
  }

  private notify(
    transition: Transition | undefined,
    reason: TransitionCallbackReason,
  ): unknown {
    this._transition = transition ?? this._transition;
    const result = this.options.callback?.(transition, reason);
    this.host.requestUpdate();
    return result;
  }
}
