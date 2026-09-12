import { TargetState, Transition, UIRouter } from '@uirouter/core';
import { nothing, ReactiveController, ReactiveControllerHost } from 'lit';

import { warnMissingRouter } from './dev-warn.js';
import type { SrefTargetParams } from './sref-active.js';
import { resolveAriaCurrent, SrefTargets } from './sref-status.js';
import { UIRouterLitElement } from './ui-router.js';
import { UI_SREF_TARGET_EVENT, UiSrefTargetEvent } from './ui-sref.js';
import {
  AriaCurrentValue,
  AriaCurrentValues,
  SrefStatus,
  TransEvt,
} from './ui-sref-active.js';
import { UiView } from './ui-view.js';

/** @internal */
type DeregisterFn = () => void;

/**
 * Options for [[SrefStatusController]]: which state to watch, plus the
 * router to watch it in.
 *
 * @category controllers
 */
export interface SrefStatusControllerOptions extends SrefTargetParams {
  /**
   * The [[UIRouter]] instance to observe.
   *
   * When omitted, the controller discovers the router from an ancestor
   * <code>&lt;ui-router&gt;</code> (or <code>&lt;ui-view&gt;</code>) via the
   * `ui-router-context` event when the host connects.
   *
   * Passing it explicitly also moves the first status computation into the
   * constructor, so the status is there for the very first render and needs
   * no DOM — the hand-off an element-less environment has no other way to
   * make.
   */
  router?: UIRouter;
}

/** the four booleans a host renders from */
type StatusFlags = [boolean, boolean, boolean, boolean];

/** @internal */
const flagsOf = (status: SrefStatus | undefined): StatusFlags => [
  status?.active ?? false,
  status?.exact ?? false,
  status?.entering ?? false,
  status?.exiting ?? false,
];

/**
 * A Lit
 * {@link https://lit.dev/docs/composition/controllers/ | ReactiveController}
 * that exposes a state's [[SrefStatus]] — `active`, `exact`, `entering`,
 * `exiting` — to its host, so the host's own template decides what to do
 * with it.
 *
 * This is the composition path {@link srefActiveClass} cannot offer: a
 * `class` attribute holds one toggling directive, so `srefActiveClass` and
 * {@link https://lit.dev/docs/templates/directives/#classmap | classMap}
 * cannot share it. Read the flags here instead and pass them to `classMap`,
 * to `aria-current`, to a `?disabled`, to anything.
 *
 * The controller registers its hooks when the host connects and deregisters
 * them on `hostDisconnected`, so nothing leaks when hosts come and go. It
 * calls `host.requestUpdate()` only when one of the four flags actually
 * changed, so transitions that leave the link alone cost no render.
 *
 * @example Composing with classMap and aria-current
 * ```ts
 * import { html, LitElement } from 'lit';
 * import { classMap } from 'lit/directives/class-map.js';
 * import { srefHref, SrefStatusController } from 'lit-ui-router';
 *
 * class NavLink extends LitElement {
 *   private users = new SrefStatusController(this, { state: 'users' });
 *
 *   render() {
 *     return html`<a
 *       href=${srefHref('users')}
 *       class=${classMap({ 'nav-link': true, active: this.users.active, disabled: this.locked })}
 *       aria-current=${this.users.ariaCurrent()}
 *     >Users</a>`;
 *   }
 * }
 * ```
 *
 * @example With an explicit router instance
 * ```ts
 * // status is computed in the constructor, before the host ever connects
 * const status = new SrefStatusController(host, { state: 'users', router });
 * ```
 *
 * @example Re-target from a property setter
 * ```ts
 * class NavLink extends LitElement {
 *   private status = new SrefStatusController(this);
 *
 *   @property() set state(state: string) {
 *     this.status.retarget({ state });
 *   }
 * }
 * ```
 *
 * @example Container mode: watch the links in the host's template
 * ```ts
 * class NavSection extends LitElement {
 *   // no `state`: every srefHref link below feeds this controller
 *   private section = new SrefStatusController(this);
 *
 *   render() {
 *     return html`<li class=${classMap({ active: this.section.active })}>
 *       <a href=${srefHref('users')}>Users</a>
 *       <a href=${srefHref('users.create')}>New</a>
 *     </li>`;
 *   }
 * }
 * ```
 *
 * @see {@link srefActiveClass}
 * @see {@link srefAriaCurrent}
 * @see {@link SrefStatus}
 *
 * @category controllers
 */
export class SrefStatusController implements ReactiveController {
  private readonly host: ReactiveControllerHost & Element;

  private options: SrefStatusControllerOptions;

  private readonly targets = new SrefTargets();

  private readonly deregisterFns: DeregisterFn[] = [];

  private _status: SrefStatus | undefined;

  /** whether a status has ever been computed, so the first one always renders */
  private computed = false;

  constructor(
    host: ReactiveControllerHost & Element,
    options: SrefStatusControllerOptions = {},
  ) {
    this.host = host;
    this.options = options;
    this.targets.params = options;
    host.addController(this);

    if (options.router) {
      // no DOM needed: the target and its status are known already
      this.targets.router = options.router;
      this.targets.setExplicit();
      this.compute();
    }
  }

  /**
   * The observed [[UIRouter]] instance.
   *
   * `undefined` until provided via
   * [[SrefStatusControllerOptions.router]] or discovered from an ancestor
   * <code>&lt;ui-router&gt;</code> on connect.
   */
  get router(): UIRouter | undefined {
    return this.targets.router;
  }

  /**
   * The merged [[SrefStatus]] of every watched target, or `undefined` while
   * there is no router or no target.
   */
  get status(): SrefStatus | undefined {
    return this._status;
  }

  /** The target state, or a child of it, is active. */
  get active(): boolean {
    return this._status?.active ?? false;
  }

  /** The target state is itself the active state. */
  get exact(): boolean {
    return this._status?.exact ?? false;
  }

  /** A transition in flight is entering the target state. */
  get entering(): boolean {
    return this._status?.entering ?? false;
  }

  /** A transition in flight is exiting the target state. */
  get exiting(): boolean {
    return this._status?.exiting ?? false;
  }

  /** The states being watched: the named one, or the enclosed links'. */
  get targetStates(): TargetState[] {
    return this._status?.targetStates ?? [];
  }

  /**
   * Points the controller at another state — for a host that takes the state
   * as a property. Replaces `state`, `params` and `options` wholesale, keeps
   * the router, and refreshes.
   */
  retarget(params: SrefTargetParams): void {
    this.options = { router: this.options.router, ...params };
    this.targets.params = this.options;
    this.targets.setExplicit();
    this.refresh();
  }

  /**
   * The `aria-current` token for the current status, or `nothing` to leave
   * the attribute off — {@link srefAriaCurrent}'s rules, as a value to bind:
   * `'page'` while the exact state is active, nothing otherwise.
   *
   * @param value another token, or `{ exact, active }` to mark an active
   *   ancestor too. See [[AriaCurrentValues]].
   */
  ariaCurrent(
    value?: AriaCurrentValue | AriaCurrentValues,
  ): AriaCurrentValue | typeof nothing {
    return this._status ? resolveAriaCurrent(this._status, value) : nothing;
  }

  /** @internal */
  hostConnected(): void {
    const { host } = this;
    this.targets.router ??=
      this.options.router ?? UIRouterLitElement.seekRouter(host);
    this.targets.relative = UiView.seekParentView(host)?.viewContext?.name;
    this.targets.setExplicit();

    // links announce themselves from inside the render root, if there is one
    const scope: EventTarget =
      (host as { renderRoot?: EventTarget }).renderRoot ?? host;
    if (!this.options.state) {
      scope.addEventListener(
        UI_SREF_TARGET_EVENT,
        this.onUiSrefTargetEvent as EventListener,
      );
      this.deregisterFns.push(() =>
        scope.removeEventListener(
          UI_SREF_TARGET_EVENT,
          this.onUiSrefTargetEvent as EventListener,
        ),
      );
    }

    const router = this.targets.router;
    if (router) {
      this.deregisterFns.push(
        router.transitionService.onStart({}, this.onTransitionStart, {
          priority: -Infinity,
        }) as DeregisterFn,
        router.stateRegistry.onStatesChanged(this.onStatesChanged),
      );
    } else {
      warnMissingRouter(
        host,
        `new SrefStatusController() on <${host.localName}>`,
        'will never be marked active',
      );
    }

    this.refresh();
  }

  /** @internal */
  hostDisconnected(): void {
    while (this.deregisterFns.length) {
      this.deregisterFns.shift()?.();
    }
  }

  /**
   * Recomputes the status and re-renders the host, but only if one of the
   * four flags moved.
   *
   * @internal
   */
  refresh(event?: TransEvt): void {
    if (this.compute(event)) {
      this.host.requestUpdate();
    }
  }

  /** the new status, and whether the host needs to see it */
  private compute(event?: TransEvt): boolean {
    const before = flagsOf(this._status);
    this._status = this.targets.status(event);
    const first = !this.computed;
    this.computed = true;
    return first || flagsOf(this._status).some((flag, i) => flag !== before[i]);
  }

  private readonly onUiSrefTargetEvent = (event: UiSrefTargetEvent): void => {
    this.targets.onLink(event);
    this.refresh();
  };

  private readonly onStatesChanged = (): void => {
    this.targets.rebuild();
    this.refresh();
  };

  private readonly onTransitionStart = (trans: Transition): void => {
    this.refresh({ evt: 'start', trans });
    trans.promise.then(
      () => this.refresh({ evt: 'success', trans }),
      () => this.refresh({ evt: 'error', trans }),
    );
  };
}
