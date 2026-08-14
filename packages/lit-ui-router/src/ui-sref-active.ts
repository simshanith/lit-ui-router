import {
  anyTrueR,
  extend,
  Param,
  PathNode,
  PathUtils,
  Predicate,
  RawParams,
  StateObject,
  tail,
  TargetState,
  Transition,
  TransitionOptions,
  unnestR,
} from '@uirouter/core';
import { noChange, ElementPart } from 'lit';
import { directive, PartInfo, PartType } from 'lit/directive.js';
import type { DirectiveResult } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';

import { UIRouterLit } from './core.js';
import { UIRouterLitElement } from './ui-router.js';
import {
  UiSrefElement,
  UiSrefTargetEvent,
  UI_SREF_TARGET_EVENT,
} from './ui-sref.js';
import { UiView } from './ui-view.js';

/** @internal */
interface TransEvt {
  evt: string;
  trans: Transition;
  status?: SrefStatus;
}

/**
 * Event name dispatched when a transition state changes.
 * @internal
 */
export const TRANSITION_STATE_CHANGE_EVENT = 'transitionStateChange';

/**
 * Enum representing the different stages of a transition.
 * @internal
 */
export enum TransitionStateChange {
  /** Transition has started */
  start = 'start',
  /** Transition completed successfully */
  success = 'success',
  /** Transition failed with an error */
  error = 'error',
}

/**
 * Status object representing the active state of a uiSref link.
 *
 * This interface describes the relationship between a link (or container
 * with links) and the current router state.
 *
 * @see {@link uiSrefActive}
 * @see [[TargetState]]
 *
 * @category types
 */
export interface SrefStatus {
  /** The sref's target state (or one of its children) is currently active */
  active: boolean;
  /** The sref's target state is currently active */
  exact: boolean;
  /** A transition is entering the sref's target state */
  entering: boolean;
  /** A transition is exiting the sref's target state */
  exiting: boolean;
  /** The enclosed sref(s) target state(s) */
  targetStates: TargetState[];
}

/**
 * Returns a Predicate<PathNode[]>
 *
 * The predicate returns true when the target state (and param values)
 * match the (tail of) the path, and the path's param values
 *
 * @internal
 */
const pathMatches = (target: TargetState): Predicate<PathNode[]> => {
  if (!target.exists()) return () => false;
  const state: StateObject = target.$state();
  const targetParamVals = target.params();
  const targetPath: PathNode[] = PathUtils.buildPath(target);
  const paramSchema: Param[] = targetPath
    .map((node) => node.paramSchema)
    .reduce<Param[]>(unnestR, [])
    .filter((param: Param) =>
      Object.prototype.hasOwnProperty.call(targetParamVals, param.id),
    );
  return (path: PathNode[] = []) => {
    const tailNode = tail(path);
    if (!tailNode || tailNode.state !== state) return false;
    const paramValues = PathUtils.paramValues(path) as RawParams;
    return Param.equals(paramSchema, paramValues, targetParamVals);
  };
};

/**
 * Given basePath: [a, b], appendPath: [c, d]),
 * Expands the path to [c], [c, d]
 * Then appends each to [a,b,] and returns: [a, b, c], [a, b, c, d]
 *
 * @internal
 */
function spreadToSubPaths(
  basePath: PathNode[],
  appendPath: PathNode[],
): PathNode[][] {
  return appendPath.map((node) =>
    basePath.concat(
      PathUtils.subPath(appendPath, (n) => n!.state === node.state),
    ),
  );
}

/** @internal */
export function mergeSrefStatus(
  left: SrefStatus,
  right: SrefStatus,
): SrefStatus {
  return {
    active: left.active || right.active,
    exact: left.exact || right.exact,
    entering: left.entering || right.entering,
    exiting: left.exiting || right.exiting,
    targetStates: [...left.targetStates, ...right.targetStates],
  };
}

/**
 * Valid `aria-current` token values.
 *
 * @see {@link UiSrefActiveParams.ariaCurrentValue}
 * @see [WAI-ARIA `aria-current`](https://www.w3.org/TR/wai-aria-1.2/#aria-current)
 *
 * @category types
 */
export type AriaCurrentValue =
  | 'page'
  | 'step'
  | 'location'
  | 'date'
  | 'time'
  | 'true';

/**
 * Per-state `aria-current` values, for the rare nav that wants to mark an
 * ancestor as well as the current page.
 *
 * Unlike `activeClasses` and `exactClasses` — which both land in `class` when a
 * link is exactly active — `aria-current` is one attribute with one value, so
 * these do not combine: on an exactly-active element `exact` wins and `active`
 * is not consulted. Each key falls back to its own default when omitted.
 *
 * @see {@link UiSrefActiveParams.ariaCurrentValue}
 *
 * @category types
 */
export interface AriaCurrentValues {
  /** Applied when the exact state is active. Defaults to `'page'` on links. */
  exact?: AriaCurrentValue | false;
  /**
   * Applied when a child state is active but this one is not the exact match —
   * `'location'` is the token meant for this. Defaults to `false`.
   */
  active?: AriaCurrentValue | false;
}

/**
 * `aria-current` defaults on for link elements only; other elements must opt in
 * explicitly, since `aria-current` on a wrapper (`<li>`, `<tr>`) is rarely intended.
 *
 * @internal
 */
const isLinkElement = (element: Element): boolean => {
  const tagName = element.tagName;
  return (
    tagName === 'A' || tagName === 'AREA' || element.matches('[role~="link"]')
  );
};

/**
 * Parameters for the uiSrefActive directive.
 *
 * @see {@link uiSrefActive}
 *
 * @category types
 */
export interface UiSrefActiveParams {
  /** CSS classes to add when the state (or a child state) is active */
  activeClasses: string[];
  /** CSS classes to add only when the exact state is active */
  exactClasses: string[];
  /**
   * The `aria-current` value to set when the **exact** state is active — the
   * same binding Vue Router's `ariaCurrentValue` uses.
   *
   * Defaults to `'page'` on link elements (`<a>`, `<area>`, `[role="link"]`).
   * Pass a value explicitly to apply it to any element; pass `false` to leave
   * `aria-current` untouched.
   *
   * Pass an object to also mark ancestors, which is otherwise off:
   * `{ exact: 'page', active: 'location' }`. See {@link AriaCurrentValues} —
   * the two do not combine the way `activeClasses` and `exactClasses` do.
   *
   * The directive only removes an `aria-current` it set itself, so a value
   * authored in the template survives.
   */
  ariaCurrentValue?: AriaCurrentValue | false | AriaCurrentValues;
  /** The state name to check for active status */
  state: string;
  /** State parameters to match */
  params?: RawParams;
  /** Transition options */
  options?: TransitionOptions;
  /** Target states from nested uiSref directives */
  targetStates: TargetState[];
}

/** @internal */
let _first: UiSrefActiveDirective | null = null;

type deregisterFn = () => void;

/**
 * Directive class that adds CSS classes based on active state.
 *
 * This directive is used internally by the {@link uiSrefActive} directive function.
 * It watches the current router state and applies CSS classes to elements
 * when their associated states are active.
 *
 * The directive can operate in two modes:
 * 1. **Explicit state**: Provide a state name to watch
 * 2. **Container mode**: Automatically watch nested uiSref directives
 *
 * @see {@link uiSrefActive} for the public API
 * @see [[AsyncDirective]]
 * @see {@link SrefStatus}
 *
 * @category directives
 */
export class UiSrefActiveDirective extends AsyncDirective {
  element: Element | null = null;

  uiRouter: UIRouterLit | undefined;
  /** @internal */
  seekRouter(): void {
    this.uiRouter = UIRouterLitElement.seekRouter(this.element!);
  }

  parentView: UiView | null = null;
  /** @internal */
  seekParentView(): void {
    this.parentView = UiView.seekParentView(this.element!);
  }

  activeClasses: string[] = [];
  exactClasses: string[] = [];
  /** undefined = default (on for link elements) */
  ariaCurrentValue: AriaCurrentValue | false | AriaCurrentValues | undefined;
  /**
   * Whether the `aria-current` currently on the element was written by this
   * directive. Guards against clearing one authored in the template.
   *
   * @internal
   */
  private ownsAriaCurrent = false;

  state: string | undefined;
  params: RawParams = {};
  options: TransitionOptions = {};

  active: boolean | undefined;
  exact: boolean | undefined;
  entering: boolean | undefined;
  exiting: boolean | undefined;

  targetStates: Set<TargetState> = new Set<TargetState>();
  uiSrefs: WeakMap<TargetState, UiSrefElement> = new WeakMap<
    TargetState,
    UiSrefElement
  >();

  /** @internal */
  _deregisterOnStart: deregisterFn | undefined;
  /** @internal */
  _deregisterOnStatesChanged: deregisterFn | undefined;

  /** @internal */
  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        'The `uiSrefActive` directive must be used as an element',
      );
    }

    _first = _first || this;
  }

  /** @internal */
  render({
    activeClasses,
    exactClasses,
    ariaCurrentValue,
  }: Partial<UiSrefActiveParams>): typeof noChange {
    if (!this._firstUpdated) {
      return noChange;
    }
    activeClasses?.forEach((className) => {
      if (this.active) {
        this.element!.classList.add(className);
      } else {
        this.element!.classList.remove(className);
      }
    });

    exactClasses?.forEach((className) => {
      if (this.exact) {
        this.element!.classList.add(className);
      } else {
        this.element!.classList.remove(className);
      }
    });

    this.applyAriaCurrent(ariaCurrentValue);

    return noChange;
  }

  /**
   * Resolves one `aria-current` value for the element's current state, then
   * applies it.
   *
   * `exact` and `active` are branches of a single decision here, not the union
   * `classList` gets: an exactly-active element takes the `exact` value and
   * never falls through to `active`. Resolving to a single value first is what
   * keeps "no opinion", "explicitly off" and "not applicable" from each needing
   * their own branch at the apply step.
   *
   * @internal
   */
  private applyAriaCurrent(
    ariaCurrentValue: UiSrefActiveParams['ariaCurrentValue'],
  ): void {
    const values: AriaCurrentValues =
      ariaCurrentValue === undefined || typeof ariaCurrentValue === 'string'
        ? { exact: ariaCurrentValue }
        : ariaCurrentValue === false
          ? { exact: false }
          : ariaCurrentValue;

    const resolved = this.exact
      ? (values.exact ?? (isLinkElement(this.element!) && 'page'))
      : this.active
        ? (values.active ?? false)
        : false;

    if (resolved) {
      this.element!.setAttribute('aria-current', resolved);
      this.ownsAriaCurrent = true;
    } else if (this.ownsAriaCurrent) {
      this.element!.removeAttribute('aria-current');
      this.ownsAriaCurrent = false;
    }
  }

  /** @internal */
  getOptions(): TransitionOptions {
    const defaultOpts: TransitionOptions = {
      relative: this.parentView?.viewContext?.name,
    };
    return extend(defaultOpts, this.options || {}) as TransitionOptions;
  }

  /**
   * Given a TransEvt (Transition event: started, success, error)
   * and a UISref Target State, return a SrefStatus object
   * which represents the current status of that Sref:
   * active, activeEq (exact match), entering, exiting
   *
   * @internal
   */
  getSrefStatus(
    event: TransEvt | undefined,
    srefTarget: TargetState,
  ): SrefStatus {
    const pathMatchesTarget = pathMatches(srefTarget);
    const tc = event?.trans.treeChanges();

    const isStartEvent = event?.evt === 'start';
    const isSuccessEvent = event?.evt === 'success';
    const activePath: PathNode[] | undefined = isSuccessEvent
      ? tc?.to
      : tc?.from;

    const isActive = () =>
      activePath
        ? spreadToSubPaths([], activePath)
            .map(pathMatchesTarget)
            .reduce(anyTrueR, false)
        : this.uiRouter!.stateService.includes(
            srefTarget.name(),
            srefTarget.params(),
          );

    const isExact = () =>
      activePath
        ? pathMatchesTarget(activePath)
        : this.uiRouter!.stateService.is(
            srefTarget.name(),
            srefTarget.params(),
          );

    const isEntering = () =>
      spreadToSubPaths(tc!.retained, tc!.entering)
        .map(pathMatchesTarget)
        .reduce(anyTrueR, false);

    const isExiting = () =>
      spreadToSubPaths(tc!.retained, tc!.exiting)
        .map(pathMatchesTarget)
        .reduce(anyTrueR, false);

    const result: SrefStatus = {
      active: isActive(),
      exact: isExact(),
      entering: isStartEvent ? isEntering() : false,
      exiting: isStartEvent ? isExiting() : false,
      targetStates: [srefTarget],
    };
    return result;
  }

  /** @internal */
  async update(
    part: ElementPart,
    [
      {
        activeClasses,
        exactClasses,
        ariaCurrentValue,
        state,
        params = {},
        options = {},
        targetStates,
      },
    ]: [UiSrefActiveParams],
  ): Promise<void> {
    this.activeClasses = activeClasses;
    this.exactClasses = exactClasses;
    this.ariaCurrentValue = ariaCurrentValue;
    this.state = state;
    this.params = params;
    this.options = options;

    const { element } = part;

    if (this.element !== element) {
      this.element = element;
      this._firstUpdated = false;
      // defer a microtask so the part's element is settled before first render
      await Promise.resolve();
      this.firstUpdated({ targetStates });
    }

    if (this.uiRouter && this._firstUpdated) {
      this.doRender();
    }
  }

  /** @internal */
  doRender = (): typeof noChange => {
    return this.render({
      activeClasses: this.activeClasses,
      exactClasses: this.exactClasses,
      ariaCurrentValue: this.ariaCurrentValue,
    });
  };

  /** @internal */
  _firstUpdated = false;
  /** @internal */
  firstUpdated({ targetStates }: Partial<UiSrefActiveParams>): void {
    if (this._firstUpdated || !this.isConnected) {
      return;
    }
    this.seekRouter();
    this.seekParentView();

    this.targetStates.clear();
    if (targetStates) {
      Array.prototype.forEach.call(targetStates, (targetState) => {
        this.targetStates.add(targetState as TargetState);
      });
    } else if (this.state) {
      this.targetStates.add(
        this.uiRouter!.stateService.target(
          this.state,
          this.params,
          this.getOptions(),
        ),
      );
    } else {
      this.element!.addEventListener(
        UI_SREF_TARGET_EVENT,
        this.onUiSrefTargetEvent as EventListener,
      );
    }
    this.element!.addEventListener(
      TRANSITION_STATE_CHANGE_EVENT,
      this.onTransitionStateChange,
    );
    this._deregisterOnStart = this.uiRouter!.transitionService.onStart(
      {},
      this.onTransitionStart,
    ) as deregisterFn;
    this._deregisterOnStatesChanged =
      this.uiRouter!.stateRegistry.onStatesChanged(this.onStatesChanged);

    setTimeout(() => {
      if (this.targetStates.size) {
        const { active, exact } = this.getStatus() || {};
        this.active = active;
        this.exact = exact;
        this.doRender();
      }
    }, 0);

    this._firstUpdated = true;
  }

  /** @internal */
  disconnected(): void {
    if (!this.element) {
      return;
    }
    this.element.removeEventListener(
      UI_SREF_TARGET_EVENT,
      this.onUiSrefTargetEvent as EventListener,
    );
    this.element.removeEventListener(
      TRANSITION_STATE_CHANGE_EVENT,
      this.onTransitionStateChange,
    );
    this.element = null;
    this._deregisterOnStart?.();
    this._deregisterOnStatesChanged?.();
  }

  /** @internal */
  createTransitionStateChangeEvent(
    evt: TransitionStateChange,
    trans: Transition,
  ): CustomEvent<TransEvt> {
    const detail: TransEvt = {
      evt,
      trans,
      status: undefined,
    };

    detail.status = this.getStatus(detail);
    return new CustomEvent<TransEvt>(TRANSITION_STATE_CHANGE_EVENT, {
      detail,
    });
  }

  /** @internal */
  onUiSrefTargetEvent = (event: UiSrefTargetEvent): void => {
    const { targetState } = event.detail;
    this.targetStates.add(targetState);
    this.uiSrefs.set(targetState, event.target);
  };

  /** @internal */
  onTransitionStateChange = (e: Event): void => {
    const event = e as unknown as CustomEvent<TransEvt>;
    const status = this.getStatus(event.detail);
    if (!status) {
      return;
    }
    const { active, exact, entering, exiting } = status;
    this.active = active;
    this.exact = exact;
    this.entering = entering;
    this.exiting = exiting;
    this.doRender();
  };

  /** @internal */
  getStatus(transEvt?: TransEvt): SrefStatus | undefined {
    const { targetStates } = this;
    if (!targetStates.size) {
      return undefined;
    }
    const statuses: SrefStatus[] = [];
    for (const target of targetStates) {
      statuses.push(this.getSrefStatus(transEvt, target));
    }
    return statuses.reduce(mergeSrefStatus);
  }

  /** @internal */
  onTransitionStart = (trans: Transition): void => {
    this.element!.dispatchEvent(
      this.createTransitionStateChangeEvent(TransitionStateChange.start, trans),
    );
    trans.promise.then(
      () => {
        this.element!.dispatchEvent(
          this.createTransitionStateChangeEvent(
            TransitionStateChange.success,
            trans,
          ),
        );
      },
      () => {
        this.element!.dispatchEvent(
          this.createTransitionStateChangeEvent(
            TransitionStateChange.error,
            trans,
          ),
        );
      },
    );
  };

  /** @internal */
  onStatesChanged = (): void => {
    const { active, exact } = this.getStatus() || {};
    this.active = active;
    this.exact = exact;
    this.doRender();
  };
}

/**
 * Directive that adds CSS classes based on active router state.
 *
 * The `uiSrefActive` directive watches the current router state and applies
 * CSS classes to elements when their associated states are active. It supports
 * both "active" classes (applied when the state or any child state is active)
 * and "exact" classes (applied only when the exact state is active).
 *
 * On link elements (`<a>`, `<area>`, `[role="link"]`) it also sets
 * `aria-current="page"` while the *exact* state is active, and removes the
 * attribute otherwise, so assistive technology gets the same "you are here"
 * signal as the active CSS class. Other elements opt in by passing
 * `ariaCurrentValue` explicitly.
 *
 * **Arguments:**
 * - `params` - Configuration object (see [[UiSrefActiveParams]]) with activeClasses, exactClasses, ariaCurrentValue, and optional state/params
 *
 * @example Basic usage with nested uiSref
 * ```ts
 * import { uiSref, uiSrefActive } from 'lit-ui-router';
 * import { html } from 'lit';
 *
 * html`
 *   <a ${uiSref('home')} ${uiSrefActive({ activeClasses: ['active'] })}>
 *     Home
 *   </a>
 * `
 * ```
 *
 * @example With exact matching
 * ```ts
 * html`
 *   <a ${uiSref('users')}
 *      ${uiSrefActive({
 *        activeClasses: ['nav-active'],
 *        exactClasses: ['nav-exact']
 *      })}>
 *     Users
 *   </a>
 * `
 * ```
 *
 * @example Container mode (watches nested uiSref directives)
 * ```ts
 * html`
 *   <nav ${uiSrefActive({ activeClasses: ['section-active'] })}>
 *     <a ${uiSref('users')}>Users</a>
 *     <a ${uiSref('users.list')}>List</a>
 *     <a ${uiSref('users.create')}>Create</a>
 *   </nav>
 * `
 * ```
 *
 * @example Customizing or disabling `aria-current`
 * ```ts
 * html`
 *   <!-- a step in a multi-step flow -->
 *   <a ${uiSref('wizard.payment')}
 *      ${uiSrefActive({ activeClasses: ['active'], ariaCurrentValue: 'step' })}>
 *     Payment
 *   </a>
 *
 *   <!-- opt a non-link element in -->
 *   <tr ${uiSref('.message', { messageId })}
 *       ${uiSrefActive({ activeClasses: ['active'], ariaCurrentValue: 'true' })}>
 *   </tr>
 *
 *   <!-- leave aria-current alone: the app manages it, and a value written
 *        here survives in every routing state -->
 *   <a ${uiSref('home')}
 *      aria-current="page"
 *      ${uiSrefActive({ activeClasses: ['active'], ariaCurrentValue: false })}>
 *     Home
 *   </a>
 *
 *   <!-- mark the ancestor section as well as the current page -->
 *   <a ${uiSref('users')}
 *      ${uiSrefActive({
 *        activeClasses: ['active'],
 *        ariaCurrentValue: { exact: 'page', active: 'location' },
 *      })}>
 *     Users
 *   </a>
 * `
 * ```
 *
 * @example Explicit state (without nested uiSref)
 * ```ts
 * html`
 *   <div ${uiSrefActive({
 *     state: 'dashboard',
 *     activeClasses: ['dashboard-active']
 *   })}>
 *     Dashboard content
 *   </div>
 * `
 * ```
 *
 * @see {@link SrefStatus}
 * @see {@link UiSrefActiveParams}
 * @see [[DirectiveResult]]
 *
 * @category directives
 */
export const uiSrefActive: (
  params: Partial<UiSrefActiveParams>,
) => DirectiveResult<typeof UiSrefActiveDirective> = directive(
  UiSrefActiveDirective,
);
