import { ReactiveController, ReactiveControllerHost } from 'lit';
import { watchSelection } from 'ui-router-signals';

/** Options for {@link SignalController}. */
export interface SignalControllerOptions<T> {
  /**
   * Invoked (before `host.requestUpdate()`) whenever the selected value
   * changes — and once on every host (re)connect. Use for effects such as
   * resetting component state from route params.
   */
  onChange?: (value: T) => void;

  /**
   * Value exposed on `.value` before the first read — that is, before
   * `hostConnected`, and on any host that renders while disconnected (SSR).
   * Without it `.value` is `undefined` until the host connects.
   */
  initialValue?: T;

  /**
   * Comparer deciding whether the selected value changed, passed to the
   * selector's `Signal.Computed`. Defaults to `Object.is`.
   */
  equals?: (a: T, b: T) => boolean;
}

/**
 * A ReactiveController that composes TC39 Signals with the Lit lifecycle:
 * while the host is connected it watches a selector through a
 * `Signal.Computed` and calls `host.requestUpdate()` when the selected value
 * changes.
 *
 * A selector-based alternative to `@lit-labs/signals`' `SignalWatcher`
 * mixin: no base class, explicit dependencies, and an `equals` comparer for
 * value-based change detection. Changes are delivered in a microtask, since
 * a watcher may not read signals while one is being set.
 *
 * The selector runs immediately on every (re)connect, so hosts that re-enter
 * the DOM (e.g. sticky routed components) synchronize with current values.
 * The selected value is exposed as `.value` for use in `render()`.
 */
export class SignalController<T> implements ReactiveController {
  /** the selected value as of the last read; read it in `render()` */
  value: T;

  private unwatch?: () => void;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly expression: () => T,
    private readonly options: SignalControllerOptions<T> = {},
  ) {
    // SAFETY: undefined unless `initialValue` is given, the pre-connect shape either way; `.value` stays `T` for render code.
    this.value = options.initialValue as T;
    host.addController(this);
  }

  hostConnected(): void {
    this.unwatch = watchSelection(
      this.expression,
      this.options.equals,
      (value) => {
        this.value = value;
        this.options.onChange?.(value);
        this.host.requestUpdate();
      },
    );
  }

  hostDisconnected(): void {
    this.unwatch?.();
    this.unwatch = undefined;
  }
}
