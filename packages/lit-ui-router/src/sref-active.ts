import {
  extend,
  RawParams,
  TargetState,
  Transition,
  TransitionOptions,
} from '@uirouter/core';
import { noChange, nothing, AttributePart } from 'lit';
import {
  AttributePartInfo,
  directive,
  PartInfo,
  PartType,
} from 'lit/directive.js';
import type { DirectiveResult } from 'lit/directive.js';
import { AsyncDirective } from 'lit/async-directive.js';

import { UIRouterLit } from './core.js';
import { warnMissingRouter } from './dev-warn.js';
import { UIRouterLitElement } from './ui-router.js';
import { UI_SREF_TARGET_EVENT, UiSrefTargetEvent } from './ui-sref.js';
import {
  AriaCurrentValue,
  AriaCurrentValues,
  mergeSrefStatus,
  SrefStatus,
  srefStatus,
  TransEvt,
} from './ui-sref-active.js';
import { UiView } from './ui-view.js';

/**
 * Which state an attribute-part active directive watches. Name a state, or
 * leave it out to watch the {@link srefHref} links inside the element instead
 * (container mode, as {@link uiSrefActive} does).
 *
 * @category types
 */
export interface SrefTargetParams {
  /** The state name to check for active status */
  state?: string;
  /** State parameters to match */
  params?: RawParams;
  /** Transition options; `relative` defaults to the enclosing view's state */
  options?: TransitionOptions;
}

type deregisterFn = () => void;

/**
 * What {@link srefActiveClass} and {@link srefAriaCurrent} share: a target
 * (named, or gathered from enclosed links), the router subscriptions that
 * recompute its {@link SrefStatus}, and the push of each new value into the
 * attribute.
 *
 * `render()` is a function of `status` and the params alone, so a server
 * renderer that runs it without `update()` gets `noChange` — the attribute
 * is left as authored — rather than a crash.
 *
 * @internal
 */
export abstract class SrefStatusDirective<
  Params extends SrefTargetParams,
> extends AsyncDirective {
  element: Element | null = null;
  uiRouter: UIRouterLit | undefined;
  parentView: UiView | null = null;

  /** the last params `update()` saw */
  params: Params | undefined;
  /** merged status of every target, or `undefined` before there is one */
  status: SrefStatus | undefined;

  /** the named target, resolved from `params.state` */
  private _explicitTarget: TargetState | null = null;
  /** container mode: each enclosed link's latest target, keyed by its element */
  private readonly _linkTargets = new Map<Element, TargetState>();

  private _firstUpdated = false;
  private _deregister: deregisterFn[] = [];

  /** the attribute this directive is bound in, for warnings */
  private readonly attributeName: string;

  /**
   * @param directiveName the public function's name, for errors and warnings
   * @internal
   */
  constructor(
    partInfo: PartInfo,
    protected readonly directiveName: string,
  ) {
    super(partInfo);
    if (partInfo.type !== PartType.ATTRIBUTE) {
      throw new Error(
        `The \`${directiveName}\` directive must be used in an attribute`,
      );
    }
    this.attributeName = partInfo.name;
  }

  /** the value for `status` and `params` as they stand */
  abstract render(params: Params): unknown;

  /**
   * What `update()` and a status change hand to the part. The default is
   * `render()`; a directive that keeps the DOM in sync itself past the first
   * commit overrides it.
   *
   * @internal
   */
  protected commit(): unknown {
    return this.render(this.params!);
  }

  /** @internal */
  update(part: AttributePart, [params]: [Params]): unknown {
    this.params = params;
    if (this.element !== part.element) {
      this.element = part.element;
      this._firstUpdated = false;
      // the part's element is not in the document yet; the seek needs it there
      setTimeout(() => {
        this.firstUpdated();
      }, 0);
    } else if (this.uiRouter) {
      // a re-render may name a different state
      this.resolveExplicitTarget();
      this.refresh();
      return noChange;
    }
    return this.commit();
  }

  /** @internal */
  getOptions(): TransitionOptions {
    const defaultOpts: TransitionOptions = {
      relative: this.parentView?.viewContext?.name,
    };
    return extend(defaultOpts, this.params?.options || {}) as TransitionOptions;
  }

  private resolveExplicitTarget(): void {
    const { state, params = {} } = this.params!;
    this._explicitTarget =
      state && this.uiRouter
        ? this.uiRouter.stateService.target(state, params, this.getOptions())
        : null;
  }

  /** the targets whose statuses merge into `status` */
  private targets(): TargetState[] {
    if (this._explicitTarget) {
      return [this._explicitTarget];
    }
    for (const element of this._linkTargets.keys()) {
      if (!element.isConnected) {
        this._linkTargets.delete(element);
      }
    }
    return [...this._linkTargets.values()];
  }

  /** @internal */
  firstUpdated(): void {
    if (this._firstUpdated || !this.isConnected) {
      return;
    }
    const element = this.element!;
    this.uiRouter = UIRouterLitElement.seekRouter(element);
    this.parentView = UiView.seekParentView(element);
    this.resolveExplicitTarget();

    if (!this.params!.state) {
      element.addEventListener(
        UI_SREF_TARGET_EVENT,
        this.onUiSrefTargetEvent as EventListener,
      );
      this._deregister.push(() =>
        element.removeEventListener(
          UI_SREF_TARGET_EVENT,
          this.onUiSrefTargetEvent as EventListener,
        ),
      );
    }

    const router = this.uiRouter;
    if (router) {
      this._deregister.push(
        router.transitionService.onStart({}, this.onTransitionStart, {
          priority: -Infinity,
        }) as deregisterFn,
        router.stateRegistry.onStatesChanged(this.onStatesChanged),
      );
    } else {
      warnMissingRouter(
        element,
        `<${element.localName} ${this.attributeName}=\${${this.directiveName}(...)}>`,
        'will never be marked active',
      );
    }

    this._firstUpdated = true;
    this.refresh();
  }

  /** @internal */
  onUiSrefTargetEvent = (event: UiSrefTargetEvent): void => {
    this._linkTargets.set(event.target, event.detail.targetState);
    this.refresh();
  };

  /**
   * A `TargetState` pins its definition when built, so one made before its
   * state was registered stays non-existent: rebuild every target first.
   *
   * @internal
   */
  onStatesChanged = (): void => {
    const $state = this.uiRouter!.stateService;
    this.resolveExplicitTarget();
    for (const [element, target] of this._linkTargets) {
      this._linkTargets.set(
        element,
        $state.target(target.identifier(), target.params(), target.options()),
      );
    }
    this.refresh();
  };

  /** @internal */
  onTransitionStart = (trans: Transition): void => {
    this.refresh({ evt: 'start', trans });
    trans.promise.then(
      () => this.refresh({ evt: 'success', trans }),
      () => this.refresh({ evt: 'error', trans }),
    );
  };

  /**
   * Recomputes `status` and pushes the result into the attribute.
   *
   * @internal
   */
  refresh(event?: TransEvt): void {
    const router = this.uiRouter;
    const targets = this.targets();
    this.status =
      router && targets.length
        ? targets
            .map((target) => srefStatus(router, event, target))
            .reduce(mergeSrefStatus)
        : undefined;
    const value = this.commit();
    if (value !== noChange && this.isConnected) {
      this.setValue(value);
    }
  }

  /** @internal */
  disconnected(): void {
    this._deregister.forEach((deregister) => deregister());
    this._deregister = [];
    this._firstUpdated = false;
  }

  /** @internal */
  reconnected(): void {
    // lit reconnects while the cached fragment is still detached; seek once
    // the element is back in the document
    setTimeout(() => {
      this.firstUpdated();
    }, 0);
  }
}

/**
 * Parameters for {@link srefActiveClass}.
 *
 * @category types
 */
export interface SrefActiveClassParams extends SrefTargetParams {
  /** CSS classes to add when the state (or a child state) is active */
  activeClasses?: string[];
  /** CSS classes to add only when the exact state is active */
  exactClasses?: string[];
}

/**
 * The attribute-part sibling of {@link UiSrefActiveDirective}'s class
 * handling, with lit's `classMap` contract: bound in `class`, alone or beside
 * static classes, and toggling only the classes it names.
 *
 * The first commit writes the whole class list — statics plus whichever of
 * ours apply — as `classMap` does, which is also what a server rendering
 * `render()` alone would emit. Every commit after that toggles names on
 * `classList`, so classes something else added to the element survive.
 *
 * @see {@link srefActiveClass} for the public API
 *
 * @category directives
 */
export class SrefActiveClassDirective extends SrefStatusDirective<SrefActiveClassParams> {
  /** classes the template wrote around the expression; never toggled */
  private _staticClasses: Set<string> | undefined;
  /** our classes on the element as of the last commit; `undefined` before one */
  private _previousClasses: Set<string> | undefined;

  /** @internal */
  constructor(partInfo: PartInfo) {
    super(partInfo, 'srefActiveClass');
    const { name, strings } = partInfo as AttributePartInfo;
    if (name !== 'class' || (strings?.length ?? 0) > 2) {
      throw new Error(
        '`srefActiveClass()` can only be used in the `class` attribute and must be the only expression in it',
      );
    }
  }

  /** each named class with whether it applies now */
  private classInfo({
    activeClasses = [],
    exactClasses = [],
  }: SrefActiveClassParams): Record<string, boolean> {
    const info: Record<string, boolean> = {};
    const { active = false, exact = false } = this.status ?? {};
    for (const name of activeClasses) {
      info[name] = active;
    }
    for (const name of exactClasses) {
      info[name] = info[name] || exact;
    }
    return info;
  }

  /**
   * The classes that apply, space-padded to keep clear of the statics; or
   * `noChange` before a status exists.
   */
  render(params: SrefActiveClassParams): string | typeof noChange {
    if (!this.status) {
      return noChange;
    }
    const info = this.classInfo(params);
    return (
      ' ' +
      Object.keys(info)
        .filter((name) => info[name])
        .join(' ') +
      ' '
    );
  }

  /** @internal */
  update(part: AttributePart, args: [SrefActiveClassParams]): unknown {
    if (this._staticClasses === undefined && part.strings !== undefined) {
      this._staticClasses = new Set(
        part.strings
          .join(' ')
          .split(/\s/)
          .filter((s) => s !== ''),
      );
    }
    return super.update(part, args);
  }

  /** @internal */
  protected commit(): unknown {
    const info = this.classInfo(this.params!);
    if (this._previousClasses === undefined) {
      const value = this.render(this.params!);
      if (value === noChange) {
        return value;
      }
      this._previousClasses = new Set();
      for (const name in info) {
        if (info[name] && !this._staticClasses?.has(name)) {
          this._previousClasses.add(name);
        }
      }
      return value;
    }

    const { classList } = this.element!;
    for (const name of this._previousClasses) {
      if (!(name in info)) {
        classList.remove(name);
        this._previousClasses.delete(name);
      }
    }
    for (const name in info) {
      const value = info[name];
      if (
        value !== this._previousClasses.has(name) &&
        !this._staticClasses?.has(name)
      ) {
        if (value) {
          classList.add(name);
          this._previousClasses.add(name);
        } else {
          classList.remove(name);
          this._previousClasses.delete(name);
        }
      }
    }
    return noChange;
  }
}

/**
 * Parameters for {@link srefAriaCurrent}.
 *
 * @category types
 */
export interface SrefAriaCurrentParams extends SrefTargetParams {
  /**
   * The token to write while the **exact** state is active — `'page'` by
   * default — or an object that also names one for an active ancestor:
   * `{ exact: 'page', active: 'location' }`. See {@link AriaCurrentValues}.
   */
  value?: AriaCurrentValue | AriaCurrentValues;
}

/**
 * The attribute-part sibling of {@link UiSrefActiveDirective}'s
 * `aria-current` handling.
 *
 * @see {@link srefAriaCurrent} for the public API
 *
 * @category directives
 */
export class SrefAriaCurrentDirective extends SrefStatusDirective<SrefAriaCurrentParams> {
  /** @internal */
  constructor(partInfo: PartInfo) {
    super(partInfo, 'srefAriaCurrent');
    if ((partInfo as AttributePartInfo).strings !== undefined) {
      throw new Error(
        '`srefAriaCurrent()` must be the only expression in its attribute',
      );
    }
  }

  /**
   * The token for the current status, `nothing` to remove the attribute, or
   * `noChange` before a status exists.
   */
  render({
    value = 'page',
  }: SrefAriaCurrentParams):
    | AriaCurrentValue
    | typeof nothing
    | typeof noChange {
    if (!this.status) {
      return noChange;
    }
    const values: AriaCurrentValues =
      typeof value === 'object' ? value : { exact: value };
    const resolved = this.status.exact
      ? (values.exact ?? 'page')
      : this.status.active
        ? (values.active ?? false)
        : false;
    return resolved || nothing;
  }
}

/**
 * Toggles classes in a `class` attribute by the active state: the
 * attribute-part form of {@link uiSrefActive}'s classes.
 *
 * It follows lit's `classMap`: it must be bound in `class`, alone or next to
 * static classes, and it only ever toggles the classes it names. Name the
 * state to watch, or leave `state` out on a wrapper to watch the
 * {@link srefHref} links inside it.
 *
 * Unlike `uiSrefActive`, this writes no `aria-current` — a `class` binding
 * cannot reach another attribute. Bind {@link srefAriaCurrent} beside it.
 *
 * @example
 * ```ts
 * import { srefHref, srefActiveClass } from 'lit-ui-router';
 * import { html } from 'lit';
 *
 * html`<a href=${srefHref('users')}
 *         class="nav-link ${srefActiveClass({ state: 'users', activeClasses: ['active'] })}">
 *   Users
 * </a>`
 * ```
 *
 * @example Container mode
 * ```ts
 * html`<li class=${srefActiveClass({ activeClasses: ['active'] })}>
 *   <a href=${srefHref('users')}>Users</a>
 * </li>`
 * ```
 *
 * @see {@link uiSrefActive}
 * @see {@link srefAriaCurrent}
 *
 * @category directives
 */
export const srefActiveClass: (
  params: SrefActiveClassParams,
) => DirectiveResult<typeof SrefActiveClassDirective> = directive(
  SrefActiveClassDirective,
);

/**
 * Binds `aria-current` to the active state: the attribute-part form of
 * {@link uiSrefActive}'s `aria-current`.
 *
 * Binding the attribute is the opt-in, so there is none of `uiSrefActive`'s
 * link detection or takeover: the value is `'page'` while the exact state is
 * active and the attribute is absent otherwise, whatever the element. Pass
 * `value` for another token, or `{ exact, active }` to mark an ancestor too.
 *
 * @example
 * ```ts
 * import { srefHref, srefAriaCurrent } from 'lit-ui-router';
 * import { html } from 'lit';
 *
 * html`<a href=${srefHref('wizard.payment')}
 *         aria-current=${srefAriaCurrent({ state: 'wizard.payment', value: 'step' })}>
 *   Payment
 * </a>`
 * ```
 *
 * @see {@link uiSrefActive}
 * @see {@link srefActiveClass}
 *
 * @category directives
 */
export const srefAriaCurrent: (
  params: SrefAriaCurrentParams,
) => DirectiveResult<typeof SrefAriaCurrentDirective> = directive(
  SrefAriaCurrentDirective,
);
