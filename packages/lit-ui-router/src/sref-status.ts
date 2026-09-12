import {
  extend,
  TargetState,
  TransitionOptions,
  UIRouter,
} from '@uirouter/core';
import { nothing } from 'lit';

import type { SrefTargetParams } from './sref-active.js';
import type { UiSrefTargetEvent } from './ui-sref.js';
import {
  AriaCurrentValue,
  AriaCurrentValues,
  mergeSrefStatus,
  SrefStatus,
  srefStatus,
  TransEvt,
} from './ui-sref-active.js';

/**
 * The target bookkeeping every sref-status binding does: a named target built
 * from {@link SrefTargetParams}, or — container mode — the latest target of
 * each {@link srefHref} link that announced itself, keyed by its element.
 *
 * Shared by the attribute-part directives and {@link SrefStatusController} so
 * the two agree on target resolution, rebuilding, pruning and merging.
 *
 * @internal
 */
export class SrefTargets {
  /** the router the targets are built against; unset until one is found */
  router: UIRouter | undefined;

  /** the latest params seen; `state` picks named over container mode */
  params: SrefTargetParams = {};

  /** the enclosing view's state name, the default for `options.relative` */
  relative: string | undefined;

  /** the named target, or `null` in container mode */
  private explicit: TargetState | null = null;

  /** container mode: each enclosed link's latest target */
  private readonly links = new Map<Element, TargetState>();

  /** `params.options` over the enclosing view's `relative` default */
  options(): TransitionOptions {
    const defaultOpts: TransitionOptions = { relative: this.relative };
    return extend(defaultOpts, this.params.options || {}) as TransitionOptions;
  }

  /** (Re)builds the named target from `params`, `relative` and `router`. */
  setExplicit(): void {
    const { state, params = {} } = this.params;
    this.explicit =
      state && this.router
        ? this.router.stateService.target(state, params, this.options())
        : null;
  }

  /** Records the target an enclosed link just announced. */
  onLink(event: UiSrefTargetEvent): void {
    this.links.set(event.target, event.detail.targetState);
  }

  /**
   * A `TargetState` pins its definition when built, so one made before its
   * state was registered stays non-existent: rebuild every target.
   */
  rebuild(): void {
    this.setExplicit();
    const $state = this.router!.stateService;
    for (const [element, target] of this.links) {
      this.links.set(
        element,
        $state.target(target.identifier(), target.params(), target.options()),
      );
    }
  }

  /** The targets whose statuses merge, pruning links that left the DOM. */
  list(): TargetState[] {
    if (this.explicit) {
      return [this.explicit];
    }
    for (const element of this.links.keys()) {
      if (!element.isConnected) {
        this.links.delete(element);
      }
    }
    return [...this.links.values()];
  }

  /** The merged status of every target, or `undefined` when there is none. */
  status(event?: TransEvt): SrefStatus | undefined {
    const router = this.router;
    const targets = this.list();
    return router && targets.length
      ? targets
          .map((target) => srefStatus(router, event, target))
          .reduce(mergeSrefStatus)
      : undefined;
  }
}

/**
 * The `aria-current` token for a status, or `nothing` to leave the attribute
 * off. `exact` and `active` are branches of one decision, not the union
 * `classList` gets: an exactly-active target never falls through to `active`.
 *
 * @internal
 */
export function resolveAriaCurrent(
  status: SrefStatus,
  value: AriaCurrentValue | AriaCurrentValues = 'page',
): AriaCurrentValue | typeof nothing {
  const values: AriaCurrentValues =
    typeof value === 'object' ? value : { exact: value };
  const resolved = status.exact
    ? (values.exact ?? 'page')
    : status.active
      ? (values.active ?? false)
      : false;
  return resolved || nothing;
}
