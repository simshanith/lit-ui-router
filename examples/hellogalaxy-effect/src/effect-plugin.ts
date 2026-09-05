// A spike of a future `ui-router-effect` package, inlined in this example so
// the whole bridge is readable in one file. It consumes `effect` directly and
// touches only public @uirouter/core API — no core types are augmented.
import {
  Cause,
  Context,
  Effect,
  Exit,
  Fiber,
  FiberSet,
  ManagedRuntime,
  Scope,
  SubscriptionRef,
} from 'effect';
import {
  BuilderFunction,
  CustomAsyncPolicy,
  HookMatchCriteria,
  HookRegOptions,
  HookResult,
  PathNode,
  RawParams,
  Resolvable,
  ResolvePolicy,
  ResolvableLiteral,
  StateDeclaration,
  StateObject,
  Transition,
  UIRouter,
  UIRouterPlugin,
} from '@uirouter/core';
import { LitStateDeclaration } from 'lit-ui-router';

/** The transition a resolve or hook effect is running inside. */
export class CurrentTransition extends Context.Tag('CurrentTransition')<
  CurrentTransition,
  Transition
>() {}

/** What {@link EffectPlugin.route} holds: the last successful transition's landing. */
export interface RouteSnapshot {
  current: StateDeclaration | undefined;
  params: RawParams;
  transition: Transition | undefined;
}

/**
 * A state declaration with a scope that lives exactly as long as the state is
 * active — opened on the `onSuccess` that entered it, closed on the one that
 * exits it.
 */
export interface EffectStateDeclaration<
  Resolves extends Record<string, unknown> = Record<string, unknown>,
  R = never,
> extends LitStateDeclaration<Resolves> {
  scoped?: (params: RawParams) => Effect.Effect<void, never, Scope.Scope | R>;
}

/** A resolve effect, before the plugin provides the path's services to it. */
type ResolveEffect = Effect.Effect<unknown, unknown>;

/** Tags declared through {@link provide}, keyed by the resolve token they use. */
const serviceTags = new Map<string, Context.Tag<never, unknown>>();

const BOX = Symbol('ui-router-effect/boxed-resolve');

interface BoxedResolve {
  [BOX]: true;
  run: () => Promise<unknown>;
}

const isBoxed = (value: unknown): value is BoxedResolve =>
  typeof value === 'object' && value !== null && BOX in value;

/**
 * The router-wide default resolve policy the plugin installs.
 *
 * `CustomAsyncPolicy` is handed only the resolveFn's settled return value, so
 * the plugin's state builder wraps every resolveFn to box an Effect together
 * with the closure that runs it. Everything else passes straight through, and
 * plain resolves keep behaving exactly as they did.
 */
export const EFFECT_WAIT: CustomAsyncPolicy = (data: unknown) =>
  isBoxed(data) ? data.run() : Promise.resolve(data);

/**
 * A resolve that publishes an Effect service to its own state and every
 * descendant, under the tag's key as the resolve token.
 *
 * Child resolves reach it with `yield* Tag` instead of a `deps: [...]` array;
 * views still see the value under `resolves[Tag.key]`.
 */
export function provide<I, S, E, R>(
  tag: Context.Tag<I, S>,
  effect: Effect.Effect<S, E, R>,
): ResolvableLiteral {
  serviceTags.set(tag.key, tag as unknown as Context.Tag<never, unknown>);
  return { token: tag.key, resolveFn: () => effect };
}

/**
 * Registers a transition hook whose callback returns an Effect. Errors must be
 * handled by the caller (`Effect.catchTag`) — what is left is the `HookResult`
 * core acts on.
 */
export interface EffectHookRegistration<R> {
  (
    criteria: HookMatchCriteria,
    callback: (
      transition: Transition,
    ) => Effect.Effect<HookResult, never, R | CurrentTransition>,
    options?: HookRegOptions,
  ): Deregister;
}

/** What core's hook registrations hand back. */
type Deregister = () => void;

/** The `resolvables` state-builder slot this plugin decorates. */
type ResolvablesBuilder = (
  state: StateObject,
  parent?: ResolvablesBuilder,
) => Resolvable[];

interface TransitionFibers {
  scope: Scope.CloseableScope;
  set: FiberSet.FiberSet;
}

/**
 * The `effect` plugin instance, reachable as
 * `router.getPlugin('effect') as EffectPlugin`.
 */
export class EffectPlugin<R = never, ER = never> implements UIRouterPlugin {
  readonly name = 'effect';

  /** The last successful transition's landing, as a stream-able ref. */
  readonly route: SubscriptionRef.SubscriptionRef<RouteSnapshot>;

  /** Timestamped lines the demo renders; the plugin writes its own. */
  readonly log: SubscriptionRef.SubscriptionRef<readonly string[]>;

  private readonly fibers = new Map<Transition, TransitionFibers>();
  private readonly scopes = new Map<string, Scope.CloseableScope>();
  private readonly deregister: Deregister[] = [];
  private disposed = false;

  constructor(
    readonly router: UIRouter,
    readonly runtime: ManagedRuntime.ManagedRuntime<R, ER>,
  ) {
    this.route = runtime.runSync(
      SubscriptionRef.make<RouteSnapshot>({
        current: undefined,
        params: {},
        transition: undefined,
      }),
    );
    this.log = runtime.runSync(SubscriptionRef.make<readonly string[]>([]));

    this.installResolvePolicy();

    // A transition's own promise only rejects once its in-flight resolves
    // settle, which is far too late to abort them. A newly created transition
    // is the earliest honest signal that the ones before it are dead.
    this.deregister.push(
      router.transitionService.onCreate({}, (transition) => {
        const alive = EffectPlugin.redirectChain(transition);
        for (const other of [...this.fibers.keys()]) {
          if (!alive.has(other)) this.closeFibers(other);
        }
      }) as Deregister,
    );

    // Both the route ref and state scopes key off onSuccess: it is the only
    // hook that cannot still be superseded.
    this.deregister.push(
      router.transitionService.onSuccess({}, (transition) => {
        void SubscriptionRef.set(this.route, {
          current: transition.to(),
          params: transition.params(),
          transition,
        }).pipe(runtime.runPromise);
        runtime.runFork(this.applyScopes(transition));
      }) as Deregister,
    );
  }

  /** Appends one timestamped line to {@link log}, stamped when it runs. */
  append(line: string): Effect.Effect<void> {
    return Effect.suspend(() => {
      const at = new Date().toLocaleTimeString('en-US', { hour12: false });
      return SubscriptionRef.update(this.log, (lines) =>
        [...lines, `${at}  ${line}`].slice(-60),
      );
    });
  }

  onBefore: EffectHookRegistration<R> = (criteria, callback, options) =>
    this.hook('onBefore', criteria, callback, options);
  onStart: EffectHookRegistration<R> = (criteria, callback, options) =>
    this.hook('onStart', criteria, callback, options);
  onFinish: EffectHookRegistration<R> = (criteria, callback, options) =>
    this.hook('onFinish', criteria, callback, options);
  onSuccess: EffectHookRegistration<R> = (criteria, callback, options) =>
    this.hook('onSuccess', criteria, callback, options);
  onError: EffectHookRegistration<R> = (criteria, callback, options) =>
    this.hook('onError', criteria, callback, options);

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const off of this.deregister) off();
    for (const scope of this.scopes.values()) {
      this.runtime.runFork(Scope.close(scope, Exit.void));
    }
    this.scopes.clear();
    void this.runtime.dispose();
  }

  /**
   * Registers a core hook whose callback returns an Effect. The promise the
   * bridge hands back is what core awaits, so a failed effect fails the
   * transition and a `TargetState` success redirects it.
   */
  private hook(
    kind: 'onBefore' | 'onStart' | 'onFinish' | 'onSuccess' | 'onError',
    criteria: HookMatchCriteria,
    callback: (
      transition: Transition,
    ) => Effect.Effect<HookResult, never, R | CurrentTransition>,
    options?: HookRegOptions,
  ): Deregister {
    // onSuccess/onError fire off the transition's own promise, by which point
    // its fiber set is already interrupted — run those on the bare runtime.
    const inSet = kind !== 'onSuccess' && kind !== 'onError';
    const off = this.router.transitionService[kind](
      criteria,
      (transition: Transition): HookResult =>
        this.runEffect(
          callback(transition) as unknown as ResolveEffect,
          transition,
          inSet,
        ) as HookResult,
      options,
    ) as Deregister;
    this.deregister.push(off);
    return off;
  }

  /**
   * Boxes every resolveFn's Effect return value and makes {@link EFFECT_WAIT}
   * the router-wide async policy. `$transition$` is prepended to each
   * resolvable's deps so the box knows which transition it belongs to.
   */
  private installResolvePolicy(): void {
    const builder: ResolvablesBuilder = (state, parentFn) => {
      const resolvables = parentFn?.(state) ?? [];
      return resolvables.map((resolvable) => {
        const inner = resolvable.resolveFn as
          | ((...deps: unknown[]) => unknown)
          | undefined;
        if (typeof inner !== 'function') return resolvable;
        const declared =
          resolvable.policy?.async ??
          (state.resolvePolicy as ResolvePolicy | undefined)?.async;
        return new Resolvable(
          resolvable.token,
          (transition: Transition, ...deps: unknown[]) => {
            const value: unknown = inner(...deps);
            if (!Effect.isEffect(value)) return value;
            return {
              [BOX]: true,
              run: () =>
                this.runEffect(value as ResolveEffect, transition, true),
            } satisfies BoxedResolve;
          },
          ['$transition$', ...(resolvable.deps as unknown[])],
          // An explicitly declared async policy (e.g. NOWAIT) still wins.
          { ...resolvable.policy, async: declared ?? EFFECT_WAIT },
        );
      });
    };
    this.router.stateRegistry.decorator(
      'resolvables',
      builder as BuilderFunction,
    );
  }

  /**
   * Runs one effect for a transition: the path's service-tagged resolves and
   * `CurrentTransition` are provided, the fiber joins the transition's set,
   * and the returned promise is what core awaits.
   */
  private runEffect(
    effect: ResolveEffect,
    transition: Transition,
    inSet: boolean,
  ): Promise<unknown> {
    const provided = Effect.provide(effect, this.contextFor(transition));
    if (!inSet) return this.runtime.runPromise(provided);
    const set = this.fibersFor(transition);
    const fiber = this.runtime.runSync(FiberSet.run(set, provided));
    return this.runtime.runPromise(Fiber.await(fiber)).then((exit) => {
      if (Exit.isSuccess(exit)) return exit.value;
      // The transition this belonged to is already dead; rejecting here would
      // only re-report the interruption as a transition error.
      if (Exit.isInterrupted(exit)) return new Promise<never>(() => {});
      throw Cause.squash(exit.cause);
    });
  }

  /** Every service-tagged resolve already resolved on the transition's path. */
  private contextFor(transition: Transition): Context.Context<never> {
    let context = Context.make(
      CurrentTransition,
      transition,
    ) as Context.Context<never>;
    const injector = transition.injector();
    for (const token of transition.getResolveTokens() as unknown[]) {
      if (typeof token !== 'string') continue;
      const tag = serviceTags.get(token);
      if (!tag) continue;
      try {
        context = Context.add(context, tag, injector.get(token));
      } catch {
        // Not resolved yet on this path — a later child resolve will see it.
      }
    }
    return context;
  }

  /**
   * One `FiberSet` per transition, closed when the transition settles and
   * interrupted the moment another transition supersedes it.
   */
  private fibersFor(transition: Transition): FiberSet.FiberSet {
    const existing = this.fibers.get(transition);
    if (existing) return existing.set;
    const scope = this.runtime.runSync(Scope.make());
    const set = this.runtime.runSync(
      Effect.provideService(FiberSet.make(), Scope.Scope, scope),
    );
    this.fibers.set(transition, { scope, set });
    const close = () => this.closeFibers(transition);
    transition.promise.then(close, close);
    return set;
  }

  private closeFibers(transition: Transition): void {
    const entry = this.fibers.get(transition);
    if (!entry) return;
    this.fibers.delete(transition);
    this.runtime.runFork(Scope.close(entry.scope, Exit.void));
  }

  /** The transition and everything it was redirected from. */
  private static redirectChain(transition: Transition): Set<Transition> {
    const chain = new Set<Transition>();
    let current: Transition | undefined = transition;
    while (current && !chain.has(current)) {
      chain.add(current);
      current = current.redirectedFrom() ?? undefined;
    }
    return chain;
  }

  /**
   * Closes exiting states' scopes child-first, then opens entering states'
   * scopes parent-first. Retained states keep the scope they already have.
   */
  private applyScopes(transition: Transition): Effect.Effect<void, never, R> {
    const closing = [...transition.treeChanges('exiting')]
      .reverse()
      .map((node) => this.closeScope(node.state.name));
    const opening = transition
      .treeChanges('entering')
      .map((node) => this.openScope(node));
    return Effect.all([...closing, ...opening], { discard: true });
  }

  private closeScope(name: string): Effect.Effect<void> {
    return Effect.suspend(() => {
      const scope = this.scopes.get(name);
      if (!scope) return Effect.void;
      this.scopes.delete(name);
      return Scope.close(scope, Exit.void);
    });
  }

  private openScope(node: PathNode): Effect.Effect<void, never, R> {
    const declaration = node.state.self as EffectStateDeclaration<
      Record<string, unknown>,
      R
    >;
    const scoped = declaration.scoped;
    if (!scoped) return Effect.void;
    return Scope.make().pipe(
      Effect.flatMap((scope) => {
        this.scopes.set(node.state.name, scope);
        return Effect.forkIn(
          Effect.provideService(scoped(node.paramValues), Scope.Scope, scope),
          scope,
        );
      }),
      Effect.asVoid,
    );
  }
}

/**
 * Builds the `router.plugin(...)` factory. The runtime is created by the app
 * (`ManagedRuntime.make(AppLayer)`) and owned by the plugin once registered:
 * `dispose` interrupts every scope and disposes the runtime.
 */
export function effectPlugin<R, ER>(
  runtime: ManagedRuntime.ManagedRuntime<R, ER>,
) {
  // Core registers plugins with `new plugin(router)`, so the factory has to
  // be constructible — an arrow function is not.
  return function (router: UIRouter): EffectPlugin<R, ER> {
    return new EffectPlugin(router, runtime);
  };
}
