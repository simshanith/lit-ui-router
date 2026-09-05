import { Effect, Fiber, Stream, SubscriptionRef } from 'effect';
import { ReactiveController, ReactiveControllerHost } from 'lit';

import { runtime } from './runtime.js';

export interface RefControllerOptions<T> {
  /**
   * Invoked (before `host.requestUpdate()`) whenever the selected value
   * changes — and once on every host (re)connect. Use for effects such as
   * resetting component state from route params.
   */
  onChange?: (value: T) => void;

  /**
   * Comparer deciding whether the selected value changed. Defaults to
   * `Object.is`; pass `Equal.equals` for `Data` structs, or a structural
   * comparer for plain objects.
   */
  equals?: (a: T, b: T) => boolean;
}

/** A tuple of `SubscriptionRef`s holding the given value tuple. */
export type SubscriptionRefs<Values extends readonly unknown[]> = {
  readonly [K in keyof Values]: SubscriptionRef.SubscriptionRef<Values[K]>;
};

/**
 * A ReactiveController that composes Effect's `SubscriptionRef` with the Lit
 * lifecycle: it selects over one or more refs and calls
 * `host.requestUpdate()` when the selected value changes.
 *
 * The subscription is a single fiber — `Stream.runForEach` over the refs'
 * `changes` — forked on the app {@link runtime} in `hostConnected` and
 * interrupted in `hostDisconnected`, so it lives exactly as long as the host
 * is in the document. `changes` replays the current value, and the controller
 * also seeds `.value` synchronously on connect, so a reconnected host (a
 * sticky routed component) renders current state, never stale state.
 *
 * The selected value is exposed as `.value` for use in `render()`; it is set
 * from `hostConnected` onwards.
 */
export class RefController<
  Values extends readonly unknown[],
  T,
> implements ReactiveController {
  /** The selected value, for use in `render()`. */
  value!: T;

  private fiber?: Fiber.RuntimeFiber<void>;
  private initialized = false;

  constructor(
    private readonly host: ReactiveControllerHost,
    private readonly refs: SubscriptionRefs<Values>,
    private readonly selector: (...values: Values) => T,
    private readonly options: RefControllerOptions<T> = {},
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    // Seed before forking: a fiber's first emission is not guaranteed to land
    // synchronously, and render() must not see an unset `.value`.
    this.emit(
      this.refs.map((ref) =>
        runtime.runSync(SubscriptionRef.get(ref)),
      ) as unknown as Values,
    );
    this.fiber = runtime.runFork(
      Stream.runForEach(this.changes(), (values) =>
        Effect.sync(() => this.emit(values)),
      ),
    );
  }

  hostDisconnected(): void {
    if (this.fiber) runtime.runFork(Fiber.interrupt(this.fiber));
    this.fiber = undefined;
    // Reconnecting re-fires onChange, as a fresh subscription would.
    this.initialized = false;
  }

  /** One stream carrying the latest value of every ref. */
  private changes(): Stream.Stream<Values> {
    const streams = this.refs.map((ref) => ref.changes);
    return Stream.zipLatestAll(...streams) as unknown as Stream.Stream<Values>;
  }

  private emit(values: Values): void {
    const selected = this.selector(...values);
    const equals = this.options.equals ?? Object.is;
    if (this.initialized && equals(selected, this.value)) return;
    this.initialized = true;
    this.value = selected;
    this.options.onChange?.(selected);
    this.host.requestUpdate();
  }
}
