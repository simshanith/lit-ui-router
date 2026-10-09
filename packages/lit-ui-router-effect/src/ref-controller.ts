import { Effect, Fiber, Stream, SubscriptionRef } from 'effect';
import { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * The slice of a runtime the controllers need. `Effect.runFork` /
 * `Effect.runSync` on the default runtime unless one is given; a
 * [`ManagedRuntime<R>`](https://effect.website/docs/runtime/#managedruntime)
 * satisfies it because the controllers' effects require nothing from `R`. It runs the controllers' own fibers; it does not provide
 * services to a selector, which stays a plain function over the values.
 */
export interface RefRuntime {
  /** starts an effect on a fiber the controller interrupts on disconnect */
  readonly runFork: (
    effect: Effect.Effect<void>,
  ) => Fiber.Fiber<unknown, unknown>;
  /** runs a synchronous effect, used to read a ref's current value */
  readonly runSync: <A>(effect: Effect.Effect<A>) => A;
}

/** {@link RefRuntime} over Effect's default runtime. */
export const defaultRefRuntime: RefRuntime = {
  runFork: (effect) => Effect.runFork(effect),
  runSync: (effect) => Effect.runSync(effect),
};

/** Options for {@link RefController}. */
export interface RefControllerOptions<T> {
  /**
   * Invoked (before `host.requestUpdate()`) whenever the selected value
   * changes — and once on every host (re)connect. Use for effects such as
   * resetting component state from route params.
   */
  onChange?: (value: T) => void;

  /**
   * Value exposed on `.value` before the first read of a ref that is only
   * resolved on `hostConnected` (see {@link RefSource}) — that is, before the
   * host connects, and on any host that renders while disconnected (SSR).
   * Refs given directly are read at construction instead, so they never need
   * it.
   */
  initialValue?: T;

  /**
   * Comparer deciding whether the selected value changed. Defaults to
   * `Object.is`; pass `Equal.equals` for structural comparison (plain objects
   * on effect 4, `Data` values on either major).
   */
  equals?: (a: T, b: T) => boolean;

  /**
   * The runtime the subscription fiber is forked on, and refs are read with.
   * Defaults to Effect's default runtime; pass the app's `ManagedRuntime` to
   * keep the fibers on one. The selector gets no services from it.
   */
  runtime?: RefRuntime;
}

/** Any tuple of `SubscriptionRef`s; `any` because the ref's type is invariant. */
// oxlint-disable-next-line typescript/no-explicit-any
export type SubscriptionRefs = readonly SubscriptionRef.SubscriptionRef<any>[];

/** The value tuple a tuple of `SubscriptionRef`s holds. */
export type RefValues<Refs extends SubscriptionRefs> = {
  [K in keyof Refs]: Refs[K] extends SubscriptionRef.SubscriptionRef<infer A>
    ? A
    : never;
};

/**
 * Where a {@link RefController} finds its refs: the tuple itself, or a thunk
 * resolved on every `hostConnected` for refs that depend on the host's place
 * in the DOM (the router's, discovered from the enclosing `<ui-router>`). A
 * thunk returning `undefined` leaves the controller idle until the host
 * reconnects.
 */
export type RefSource<Refs extends SubscriptionRefs> =
  | Refs
  | (() => Refs | undefined);

/**
 * A ReactiveController that composes Effect's `SubscriptionRef` with the Lit
 * lifecycle: it selects over one or more refs and calls
 * `host.requestUpdate()` when the selected value changes.
 *
 * The subscription is a single fiber — `Stream.runForEach` over the refs'
 * `changes` — forked in `hostConnected` and interrupted in
 * `hostDisconnected`, so it lives exactly as long as the host is in the
 * document. The interrupt goes to the fiber directly, so it does not depend
 * on the runtime still being alive. `changes` replays the current value, and
 * the controller also seeds `.value` synchronously on connect, so a
 * reconnected host (a sticky routed component) renders current state, never
 * stale state.
 *
 * Refs given directly are read once more at construction, so `.value` is
 * live before the host ever connects — a host rendered on the server sees
 * the same value a browser would. Refs resolved on connect carry
 * `options.initialValue` until then.
 *
 * The selected value is exposed as `.value` for use in `render()`.
 */
export class RefController<
  const Refs extends SubscriptionRefs,
  T,
> implements ReactiveController {
  /** The selected value, for use in `render()`. */
  value: T;

  private fiber?: Fiber.Fiber<unknown, unknown>;
  private initialized = false;
  private connected = false;
  private readonly runtime: RefRuntime;

  constructor(
    private readonly host: ReactiveControllerHost,
    private refs: RefSource<Refs>,
    private readonly selector: (...values: RefValues<Refs>) => T,
    private readonly options: RefControllerOptions<T> = {},
  ) {
    this.runtime = options.runtime ?? defaultRefRuntime;
    // Undefined unless `initialValue` is given, which is the pre-connect
    // shape either way; the cast keeps `.value` typed `T` for render code.
    this.value =
      typeof refs === 'function'
        ? (options.initialValue as T)
        : selector(...this.read(refs));
    host.addController(this);
  }

  hostConnected(): void {
    this.connected = true;
    this.fork();
  }

  hostDisconnected(): void {
    this.connected = false;
    this.interrupt();
  }

  /**
   * Replaces the refs. A connected controller interrupts its fiber and
   * re-seeds and re-forks on the new refs, as a reconnect does; a
   * disconnected one only records them for its next `hostConnected`.
   */
  protected setRefs(refs: RefSource<Refs>): void {
    this.refs = refs;
    if (!this.connected) return;
    this.interrupt();
    this.fork();
  }

  private fork(): void {
    const refs = typeof this.refs === 'function' ? this.refs() : this.refs;
    if (!refs) return;
    // Seed before forking: a fiber's first emission is not guaranteed to land
    // synchronously, and render() must not see a stale `.value`.
    this.emit(this.read(refs));
    this.fiber = this.runtime.runFork(
      Stream.runForEach(RefController.changes(refs), (values) =>
        Effect.sync(() => this.emit(values)),
      ),
    );
  }

  private interrupt(): void {
    if (this.fiber) interruptFiber(this.fiber);
    this.fiber = undefined;
    // Reconnecting re-fires onChange, as a fresh subscription would.
    this.initialized = false;
  }

  private read(refs: Refs): RefValues<Refs> {
    return refs.map((ref): unknown =>
      this.runtime.runSync(SubscriptionRef.get(ref)),
    ) as unknown as RefValues<Refs>;
  }

  /** One stream carrying the latest value of every ref. */
  private static changes<Refs extends SubscriptionRefs>(
    refs: Refs,
  ): Stream.Stream<RefValues<Refs>> {
    const streams = refs.map(changesOf);
    return Stream.zipLatestAll(...streams) as unknown as Stream.Stream<
      RefValues<Refs>
    >;
  }

  private emit(values: RefValues<Refs>): void {
    const selected = this.selector(...values);
    const equals = this.options.equals ?? Object.is;
    if (this.initialized && equals(selected, this.value)) return;
    this.initialized = true;
    this.value = selected;
    this.options.onChange?.(selected);
    this.host.requestUpdate();
  }
}

/** The stream of a ref's current and later values. */
function changesOf<A>(
  ref: SubscriptionRef.SubscriptionRef<A>,
): Stream.Stream<A> {
  // effect 3 carries the stream on the ref; effect 4 exports SubscriptionRef.changes.
  // Static read keeps effect 4 tree-shaking; effect 3 bundlers warn IMPORT_IS_UNDEFINED.
  const own = (ref as unknown as { readonly changes?: Stream.Stream<A> })
    .changes;
  if (own) return own;
  return (
    SubscriptionRef as unknown as {
      readonly changes: (
        self: SubscriptionRef.SubscriptionRef<A>,
      ) => Stream.Stream<A>;
    }
  ).changes(ref);
}

/** A fiber's synchronous interrupt as effect 3 names it. */
interface Effect3Fiber {
  unsafeInterruptAsFork(fiberId: unknown): void;
  id(): unknown;
}

/** A fiber's synchronous interrupt as effect 4 names it. */
interface Effect4Fiber {
  interruptUnsafe(): void;
}

function interruptFiber(fiber: Fiber.Fiber<unknown, unknown>): void {
  const live = fiber as unknown as Effect3Fiber | Effect4Fiber;
  if ('interruptUnsafe' in live) live.interruptUnsafe();
  else live.unsafeInterruptAsFork(live.id());
}
