import {
  anyTrueR,
  extend,
  Param,
  PathNode,
  PathUtils,
  Predicate,
  StateObject,
  tail,
  TargetState,
  Transition,
  TransitionOptions,
  unnestR,
} from '@uirouter/core';
import { noChange, ElementPart } from 'lit';
import { directive, PartInfo, PartType } from 'lit/directive.js';
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

export const TRANSITION_STATE_CHANGE_EVENT = 'transitionStateChange';

export enum TransitionStateChange {
  start = 'start',
  success = 'success',
  error = 'error',
}

/**
 * UISref status emitted from [[UISrefStatus]]
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
    .reduce(unnestR, [])
    .filter((param: Param) =>
      Object.prototype.hasOwnProperty.call(targetParamVals, param.id),
    );
  return (path: PathNode[] = []) => {
    const tailNode = tail(path);
    if (!tailNode || tailNode.state !== state) return false;
    const paramValues = PathUtils.paramValues(path);
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

export interface UiSrefActiveParams {
  activeClasses: string[];
  exactClasses: string[];
  state: string;
  params: any;
  options: TransitionOptions;
  targetStates: TargetState[];
}

let _first: UiSrefActiveDirective | null = null;

type deregisterFn = () => void;

export class UiSrefActiveDirective extends AsyncDirective {
  element: Element | null = null;

  uiRouter: UIRouterLit | undefined;
  seekRouter() {
    this.uiRouter = UIRouterLitElement.seekRouter(this.element!);
  }

  parentView: UiView | null = null;
  seekParentView() {
    this.parentView = UiView.seekParentView(this.element!);
  }

  activeClasses: string[] = [];
  exactClasses: string[] = [];

  state: string | undefined;
  params: any = {};
  options: TransitionOptions = {};

  active: boolean | undefined;
  exact: boolean | undefined;
  entering: boolean | undefined;
  exiting: boolean | undefined;

  targetStates = new Set<TargetState>();
  uiSrefs = new WeakMap<TargetState, UiSrefElement>();

  _deregisterOnStart: deregisterFn | undefined;
  _deregisterOnStatesChanged: deregisterFn | undefined;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        'The `uiSrefActive` directive must be used as an element',
      );
    }

    _first = _first || this;
  }

  render({ activeClasses, exactClasses }: Partial<UiSrefActiveParams>) {
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

    return noChange;
  }

  getOptions(): TransitionOptions {
    const defaultOpts: TransitionOptions = {
      relative: this.parentView?.viewContext?.name,
    };
    return extend(defaultOpts, this.options || {});
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

  async update(
    part: ElementPart,
    [
      {
        activeClasses,
        exactClasses,
        state,
        params = {},
        options = {},
        targetStates,
      },
    ]: [UiSrefActiveParams],
  ) {
    this.activeClasses = activeClasses;
    this.exactClasses = exactClasses;
    this.state = state;
    this.params = params;
    this.options = options;

    const { element } = part;

    if (this.element !== element) {
      this.element = element;
      this._firstUpdated = false;
      await 0;
      this.firstUpdated({ targetStates });
    }

    if (this.uiRouter && this._firstUpdated) {
      this.doRender();
    }
  }

  doRender = () => {
    return this.render({
      activeClasses: this.activeClasses,
      exactClasses: this.exactClasses,
    });
  };

  _firstUpdated = false;
  async firstUpdated({ targetStates }: Partial<UiSrefActiveParams>) {
    if (this._firstUpdated || !this.isConnected) {
      return;
    }
    this.seekRouter();
    this.seekParentView();

    this.targetStates.clear();
    if (targetStates) {
      Array.prototype.forEach.call(targetStates, (targetState) => {
        this.targetStates.add(targetState);
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
      this.uiRouter!.stateRegistry.onStatesChanged(
        this.onStatesChanged,
      ) as deregisterFn;

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

  disconnected() {
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

  createTransitionStateChangeEvent(
    evt: TransitionStateChange,
    trans: Transition,
  ) {
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

  onUiSrefTargetEvent = (event: UiSrefTargetEvent) => {
    const { targetState } = event.detail;
    this.targetStates.add(targetState);
    this.uiSrefs.set(targetState, event.target as UiSrefElement);
  };

  onTransitionStateChange = async (e: Event) => {
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

  getStatus(transEvt?: TransEvt): SrefStatus | undefined {
    const { targetStates } = this;
    if (!targetStates.size) {
      return;
    }
    const statuses: SrefStatus[] = [];
    for (const target of targetStates) {
      statuses.push(this.getSrefStatus(transEvt, target));
    }
    return statuses.reduce(mergeSrefStatus);
  }

  onTransitionStart = (trans: Transition) => {
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

  onStatesChanged = () => {
    const { active, exact } = this.getStatus() || {};
    this.active = active;
    this.exact = exact;
    this.doRender();
  };
}

export const uiSrefActive = directive(UiSrefActiveDirective);
