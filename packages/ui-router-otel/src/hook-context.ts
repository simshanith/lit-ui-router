import { context, trace, type Span } from '@opentelemetry/api';
import type {
  HookMatchCriteria,
  HookResult,
  RegisteredHook,
  StateDeclaration,
  Transition,
  TransitionService,
  UIRouter,
} from '@uirouter/core';
import type { KnownPhase } from '@repo/router-events/schema';

/** The span of a phase that is open now; the reporter's, so a hook runs with its own phase's span active. */
export interface HookSpans {
  phaseSpan(
    id: number,
    phase: KnownPhase,
    state?: string | null,
  ): Span | undefined;
}

const PHASES = {
  onBefore: 'before',
  onStart: 'start',
  onExit: 'exit',
  onRetain: 'retain',
  onEnter: 'enter',
  onFinish: 'finish',
  onSuccess: 'success',
  onError: 'error',
} as const satisfies Record<string, KnownPhase>;

type EventName = keyof typeof PHASES;

const EVENTS: readonly EventName[] = [
  'onBefore',
  'onStart',
  'onExit',
  'onRetain',
  'onEnter',
  'onFinish',
  'onSuccess',
  'onError',
];

// The adapter brackets each phase at these priorities, so a hook at or past them is instrumentation, not the app's.
const FIRST = Number.MAX_SAFE_INTEGER;

// Core binds a hook to its registration's `bind` option, which it types any.
type Bind = RegisteredHook['bind'];

type Hook = (
  this: Bind,
  trans: Transition,
  state?: StateDeclaration,
) => HookResult;

type Registry = Pick<TransitionService, 'getHooks'>;

type Keep = (criteria: HookMatchCriteria, callback: Hook) => Hook;

type Probe = Record<EventName | 'onCreate', Keep> & {
  _deregisterHookFns: Record<string, Hook>;
};

// Core's hooks that call a state's own onEnter, onExit and onRetain, so they run the app's code.
const STATE_HOOKS: ReadonlySet<string> = new Set([
  'onEnter',
  'onExit',
  'onRetain',
]);

/** Core's own hook functions, read by running core's private registration on a probe that keeps each callback. */
const coreHooksOf = (service: TransitionService): ReadonlySet<Hook> | null => {
  // SAFETY: a private core method; it calls `this.on<Event>(criteria, callback)` and keeps each result by name
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- core declares it private, so one assertion cannot reach it
  const { _registerCoreTransitionHooks: register } = service as unknown as {
    _registerCoreTransitionHooks?: (this: Probe) => void;
  };

  if (!register) return null;

  const keep: Keep = (_criteria, callback) => callback;

  const probe: Probe = {
    _deregisterHookFns: {},
    onCreate: keep,
    onBefore: keep,
    onStart: keep,
    onExit: keep,
    onRetain: keep,
    onEnter: keep,
    onFinish: keep,
    onSuccess: keep,
    onError: keep,
  };

  register.call(probe);

  return new Set(
    Object.entries(probe._deregisterHookFns).flatMap(([name, hook]) =>
      STATE_HOOKS.has(name) ? [] : [hook],
    ),
  );
};

/**
 * Runs each app transition hook with its phase's span active, so a span the app starts in it is that span's child.
 * What follows an `await` keeps it only under a context manager that follows async work. Returns the disposer.
 */
export const activateHookSpans = (
  router: UIRouter,
  spans: HookSpans,
): (() => void) => {
  const service = router.transitionService;
  const core = coreHooksOf(service);

  if (!core) return () => {};

  const originals = new WeakMap<Hook, Hook>();

  // Opt-in monkey-patch: core has no hook invocation notification, so each registered hook's callback is wrapped.
  const wrap = (hook: RegisteredHook, phase: KnownPhase) => {
    // SAFETY: core invokes every hook as `callback.call(bind, transition, state)`
    const original = hook.callback as Hook;

    if (
      originals.has(original) ||
      core.has(original) ||
      Math.abs(hook.priority) >= FIRST
    )
      return;

    const wrapper: Hook = function (this: Bind, trans, state) {
      // A state hook's phase is its state's; a transition hook has no state.
      const span = spans.phaseSpan(trans.$id, phase, state?.name);

      return span
        ? context.with(
            trace.setSpan(context.active(), span),
            original,
            this,
            trans,
            state,
          )
        : original.call(this, trans, state);
    };

    originals.set(wrapper, original);
    hook.callback = wrapper;
  };

  const scan = (registry: Registry) => {
    for (const name of EVENTS)
      for (const hook of registry.getHooks(name)) wrap(hook, PHASES[name]);
  };

  scan(service);

  // A hook registered later, on the service or on the transition, is wrapped before the phase that runs it.
  const rescan = (trans: Transition) => {
    scan(service);
    scan(trans);
  };

  // SAFETY: core types every hook deregistration as Function; each takes no arguments
  const offs = [
    service.onBefore({}, rescan, { priority: FIRST }),
    service.onStart({}, rescan, { priority: FIRST }),
    service.onSuccess({}, rescan, { priority: FIRST }),
    service.onError({}, rescan, { priority: FIRST }),
  ] as (() => void)[];

  // A transition's own hooks keep their wrapper, which passes through once the reporter is disposed.
  return () => {
    for (const off of offs) off();

    for (const name of EVENTS)
      for (const hook of service.getHooks(name)) {
        // SAFETY: core invokes every hook as `callback.call(bind, transition, state)`
        const original = originals.get(hook.callback as Hook);

        if (original) hook.callback = original;
      }
  };
};
