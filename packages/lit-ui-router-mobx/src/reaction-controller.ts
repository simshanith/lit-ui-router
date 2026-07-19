import { ReactiveController, ReactiveControllerHost } from 'lit';
import { IEqualsComparer, IReactionDisposer, reaction } from 'mobx';

export interface ReactionControllerOptions<T> {
  /**
   * Invoked (before `host.requestUpdate()`) whenever the selected value
   * changes — and once on every host (re)connect. Use for effects such as
   * resetting component state from route params.
   */
  onChange?: (value: T) => void;

  /**
   * Comparer deciding whether the selected value changed
   * (e.g. `comparer.structural`). Defaults to MobX's identity comparer.
   */
  equals?: IEqualsComparer<T>;
}

/**
 * A ReactiveController that composes MobX with the Lit lifecycle: it runs a
 * MobX `reaction` over an explicit selector while the host is connected and
 * calls `host.requestUpdate()` when the selected value changes.
 *
 * This is a selector-based alternative to render auto-tracking mixins such
 * as [`MobxLitElement`](https://github.com/adobe/lit-mobx):
 *
 * - No base class required — works on any LitElement (or other host).
 * - Dependencies are explicit: the selector names exactly which observables
 *   drive the host, and `equals: comparer.structural` gives precise,
 *   value-based change detection.
 * - Lifecycle is automatic: the reaction is created in `hostConnected` and
 *   disposed in `hostDisconnected` — no manual disposer bookkeeping.
 * - The reaction fires immediately on (re)connect, so hosts that re-enter
 *   the DOM (e.g. sticky routed components) synchronize with the current
 *   store state instead of rendering stale values.
 *
 * The selected value is exposed as `.value` for use in `render()`.
 */
export class ReactionController<T> implements ReactiveController {
  value!: T;

  private dispose?: IReactionDisposer;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly expression: () => T,
    private readonly options: ReactionControllerOptions<T> = {},
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    this.dispose = reaction(
      this.expression,
      (value) => {
        this.value = value;
        this.options.onChange?.(value);
        this.host.requestUpdate();
      },
      { fireImmediately: true, equals: this.options.equals },
    );
  }

  hostDisconnected(): void {
    this.dispose?.();
    this.dispose = undefined;
  }
}
