import {
  Rejection,
  RejectType,
  type HookMatchCriteria,
  type PathNode,
  type RawParams,
  type StateDeclaration,
  TargetState,
  type Transition,
  type UIRouter,
} from '@uirouter/core';
import { errorNameOf, messageOf } from './thrown.ts';
import { timeResolvables } from './resolve-timing.ts';
import { sourceOf } from './transition-source.ts';
import {
  SCHEMA_VERSION,
  type ConfigEvent,
  type RouterEvent,
  type LocationInfo,
  type Outcome,
  type ParamValue,
  type Params,
  type KnownPhase,
  type ResultEvent,
  type Scalar,
  type StateInfo,
  type TransitionOptionsInfo,
} from './event-schema.ts';

export interface ObserveOptions {
  /** Time each resolve by wrapping its `resolveFn`; off by default because it patches core objects. */
  timeResolves?: boolean;
}

type Draft<E> = E extends RouterEvent ? Omit<E, 'v' | 'seq' | 't'> : never;

type Emit = (event: Draft<RouterEvent>) => void;

// Number.MAX_SAFE_INTEGER as a literal: shared source holds no evaluated module state.
const HIGH = 9_007_199_254_740_991;

const LOW = -9_007_199_254_740_991;

// Every target runtime has these; declared here so the module compiles without DOM or node types.
declare const performance: { now(): number };

declare function setTimeout(handler: () => void): void;

const now = (): number => performance.now();

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- an object param value, which the app types
const jsonText = (value: unknown): string => {
  try {
    // JSON.stringify returns undefined for a value whose toJSON returns undefined.
    const text: string | undefined = JSON.stringify(value);

    return text ?? '[unserializable]';
  } catch {
    return '[unserializable]';
  }
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a param value, which the app types
const scalarOf = (value: unknown): Scalar => {
  if (value === null || value === undefined) return null;

  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- sorting an app's param value into what JSON can hold is this function's job
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      return Number.isFinite(value) ? value : String(value);
    case 'bigint':
      return `[bigint ${value}n]`;
    case 'function':
      return '[function]';
    case 'symbol':
      return '[symbol]';
    default:
      return jsonText(value);
  }
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a param value, which the app types
const paramValueOf = (value: unknown): ParamValue =>
  Array.isArray(value) ? value.map(scalarOf) : scalarOf(value);

const paramsOf = (params: RawParams): Params =>
  Object.fromEntries(
    Object.entries(params)
      .filter(([key, value]) => !(key === '#' && value == null))
      .map(([key, value]) => [key, paramValueOf(value)]),
  );

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- core types resolve tokens any
const tokenName = (token: unknown): string =>
  token instanceof Function ? token.name || '[function]' : String(token);

const resolveTokens = (decl: StateDeclaration): string[] => {
  const resolve = decl.resolve;

  return Array.isArray(resolve)
    ? resolve.map((entry) =>
        tokenName('token' in entry ? entry.token : entry.provide),
      )
    : Object.keys(resolve ?? {});
};

interface NamedTarget {
  state?: string | StateDeclaration;
}

type DsrProp =
  | boolean
  | string
  | ((...args: never[]) => void)
  | { default?: string | NamedTarget };

// The @uirouter/dsr and @uirouter/sticky-states declaration properties, which core does not declare.
interface PluginDeclaration extends StateDeclaration {
  dsr?: DsrProp;
  deepStateRedirect?: DsrProp;
  sticky?: boolean;
}

type DeclaredTarget =
  | StateDeclaration['redirectTo']
  | NamedTarget
  | boolean
  | ((...args: never[]) => void);

// A target is named only when the declaration holds it as data; a function's result is unknown until it runs.
const staticTarget = (target: DeclaredTarget): string | null => {
  if (target instanceof TargetState) return target.name();

  /* oxlint-disable anti-slop/no-runtime-typeof -- the declaration's own union: a name, a target literal or a function */
  if (typeof target === 'string') return target;

  if (typeof target !== 'object' || target === null) return null;

  const state: NamedTarget['state'] = target.state;

  return (typeof state === 'string' ? state : state?.name) ?? null;
  /* oxlint-enable anti-slop/no-runtime-typeof */
};

const dsrOf = (decl: PluginDeclaration): StateInfo['dsr'] => {
  const prop = decl.deepStateRedirect || decl.dsr;

  if (!prop) return undefined;

  return {
    default: staticTarget(
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the plugin's own union: a config object or a bare target
      typeof prop === 'object' ? prop.default : prop,
    ),
  };
};

const describeState = (
  router: UIRouter,
  decl: PluginDeclaration,
): StateInfo => {
  const name = decl.name ?? '';
  const future = name.endsWith('.**');
  const bare = future ? name.slice(0, -3) : name;
  const dot = bare.lastIndexOf('.');

  const declaredParent =
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the declaration's own union: a name or a parent declaration
    typeof decl.parent === 'string' ? decl.parent : decl.parent?.name;

  // TargetState.$state() is the public route to the built StateObject.
  const object = router.stateService.target(name).$state();

  const params = (object?.parameters({ inherit: false }) ?? [])
    .filter((param) => param.id !== '#')
    .map((param) => ({
      id: param.id,
      type: param.type.name,
      optional: param.isOptional,
      dynamic: param.dynamic,
      array: param.array,
      inherit: param.inherit,
      squash: param.squash,
    }));

  const redirectTo = staticTarget(decl.redirectTo);
  const dsr = dsrOf(decl);

  return {
    name,
    parent: declaredParent ?? (dot === -1 ? null : bare.slice(0, dot)),
    url: decl.url ?? null,
    params,
    resolves: resolveTokens(decl),
    future,
    abstract: Boolean(decl.abstract),
    redirects: decl.redirectTo !== undefined,
    ...(redirectTo !== null && { redirectTo }),
    ...(dsr && { dsr }),
    ...(decl.sticky && { sticky: true }),
  };
};

const locationKind = (plugin: string | null): LocationInfo['kind'] => {
  if (!plugin) return 'other';

  if (/hash/i.test(plugin)) return 'hash';

  if (/pushstate/i.test(plugin)) return 'pushState';

  if (/memory/i.test(plugin)) return 'memory';

  return 'other';
};

const readConfig = (router: UIRouter): Draft<ConfigEvent> => {
  const config = router.urlService.config;
  const plugins = router.getPlugin().map((plugin) => plugin.name);

  // Location plugins are the ones that carry a `service`; the plugin type does not declare it.
  const location =
    router
      .getPlugin()
      .find((plugin) => 'service' in plugin && 'configuration' in plugin)
      ?.name ?? null;

  return {
    type: 'config',
    location: {
      kind: locationKind(location),
      plugin: location,
      baseHref: config.baseHref(),
      hashPrefix: config.hashPrefix(),
      html5Mode: config.html5Mode(),
    },
    strictMode: config.strictMode(),
    caseInsensitive: config.caseInsensitive(),
    plugins,
  };
};

const optionsOf = (trans: Transition): TransitionOptionsInfo => {
  const options = trans.options();
  const reload = options.reload;

  return {
    source: sourceOf(options),
    location: options.location ?? true,
    reload:
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the option's own union: a flag, a state name or a state
      typeof reload === 'object' && reload !== null
        ? String(reload.name)
        : (reload ?? false),
    inherit: options.inherit ?? true,
    supercede: options.supercede ?? true,
  };
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a transition's rejection reason, which core types any
const outcomeOf = (error: unknown): Outcome => {
  if (!(error instanceof Rejection)) return 'error';

  switch (error.type) {
    case RejectType.SUPERSEDED:
      return error.redirected ? 'redirected' : 'superseded';
    case RejectType.ABORTED:
      return 'aborted';
    case RejectType.IGNORED:
      return 'ignored';
    case RejectType.INVALID:
      return 'invalid';
    default:
      return 'error';
  }
};

// Core's invalid-transition hook throws `trans.error()` as a plain Error's message, so the rejection arrives as an error.
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a transition's rejection reason, which core types any
const invalidOf = (trans: Transition, error: unknown): Rejection | null => {
  if (!(error instanceof Rejection) || error.type !== RejectType.ERROR)
    return null;

  const invalid: unknown = trans.error();

  if (!(invalid instanceof Rejection) || invalid.type !== RejectType.INVALID)
    return null;

  const thrown: unknown = error.detail;

  return thrown instanceof Error &&
    thrown.message.includes(String(invalid.detail))
    ? invalid
    : null;
};

const invalidParamsOf = (trans: Transition): string[] => {
  const values = trans.params();

  return trans
    .$to()
    .parameters()
    .filter((param) => !param.validates(values[param.id]))
    .map((param) => param.id);
};

type Settled = Omit<Draft<ResultEvent>, 'type' | 'id'>;

// What a rejection says, read from core's own objects rather than its printed form.
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- a transition's rejection reason, which core types any
const settledOf = (trans: Transition, error: unknown): Settled => {
  const invalid = invalidOf(trans, error);

  if (invalid) {
    const invalidParams = invalidParamsOf(trans);

    return {
      outcome: 'invalid',
      message: messageOf(invalid),
      ...(invalidParams.length && { invalidParams }),
    };
  }

  const outcome = outcomeOf(error);
  const detail: unknown = error instanceof Rejection ? error.detail : null;

  // Core says why it aborted: a hook returned false, or the router was disposed; abort() gives no reason.
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- core's abort reason is a string or nothing
  if (outcome === 'aborted' && typeof detail === 'string')
    return { outcome, message: detail };

  if (outcome !== 'error' && outcome !== 'invalid') return { outcome };

  const errorName = errorNameOf(error);

  return {
    outcome,
    message: messageOf(error),
    ...(errorName !== undefined && { errorName }),
  };
};

const names = (nodes: PathNode[]): string[] =>
  nodes.flatMap((node) => (node.state.name ? [node.state.name] : []));

// Observes one router through public hooks and calls `listener` with JSON-safe events; returns the disposer.
export const observe = (
  router: UIRouter,
  listener: (event: RouterEvent) => void,
  { timeResolves = false }: ObserveOptions = {},
): (() => void) => {
  let seq = 0;

  const emit: Emit = (draft) =>
    listener({ v: SCHEMA_VERSION, seq: ++seq, t: now(), ...draft });

  const started: { id: number; redirectedFrom: number | null }[] = [];
  // Ids in the order they left the before phase, the order core makes each the current transition.
  const began: number[] = [];
  let lastConfig = '';

  const emitConfig = () => {
    const config = readConfig(router);
    const key = JSON.stringify(config);

    if (key === lastConfig) return;
    lastConfig = key;
    emit(config);
  };

  const emitStates = () =>
    emit({
      type: 'states',
      states: router.stateRegistry
        .get()
        .filter((decl) => decl.name)
        .map((decl) => describeState(router, decl)),
    });

  const emitCurrent = () =>
    emit({
      type: 'current',
      name: router.globals.current.name ?? '',
      params: paramsOf(router.globals.params),
    });

  emitConfig();
  emitStates();
  emitCurrent();

  // A redirect's origin rejects before its successor starts, so its result waits for the successor or a task.
  const pendingRedirects = new Map<number, () => void>();

  // Core's superseded detail is whichever transition is current when this one notices: possibly a later one, or none.
  const takenOverBy = (outcome: Outcome, id: number): number | undefined => {
    if (outcome === 'redirected')
      return started.find((s) => s.redirectedFrom === id)?.id;

    return outcome === 'superseded' ? began[began.indexOf(id) + 1] : undefined;
  };

  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a transition's rejection reason, which core types any
  const settle = (trans: Transition, error?: unknown) => {
    const id = trans.$id;

    const settled: Settled =
      error === undefined ? { outcome: 'success' } : settledOf(trans, error);

    const send = () => {
      pendingRedirects.delete(id);

      const by = takenOverBy(settled.outcome, id);

      emit({
        type: 'result',
        id,
        ...settled,
        ...(by !== undefined && { by }),
      });
    };

    if (settled.outcome !== 'redirected') {
      send();

      return;
    }

    pendingRedirects.set(id, send);
    setTimeout(() => pendingRedirects.get(id)?.());
  };

  const service = router.transitionService;
  const deregister: (() => void)[] = [];

  // SAFETY: core types every hook deregistration as Function; each takes no arguments
  const add = (fn: ReturnType<typeof service.onStart>) =>
    deregister.push(fn as () => void);

  const mark =
    (phase: KnownPhase, edge: 'start' | 'end') =>
    (trans: Transition, state?: StateDeclaration) => {
      // State hooks also fire for the unnamed root state; it is not a row anywhere.
      if (state && !state.name) return;

      // The lowest-priority before hook runs after core's ignore and validity checks, just before core makes the transition current.
      if (phase === 'before' && edge === 'end') {
        began.push(trans.$id);

        if (began.length > 256) began.shift();
      }

      emit({
        type: 'phase',
        id: trans.$id,
        phase,
        edge,
        state: state?.name || null,
      });
    };

  const bracket = (
    register: typeof service.onStart,
    phase: KnownPhase,
    criteria: HookMatchCriteria = {},
  ) => {
    add(
      register.call(service, criteria, mark(phase, 'start'), {
        priority: HIGH,
      }),
    );
    add(
      register.call(service, criteria, mark(phase, 'end'), { priority: LOW }),
    );
  };

  add(
    service.onBefore(
      {},
      (trans) => {
        emitConfig();
        const changes = trans.treeChanges();
        const redirectedFrom = trans.redirectedFrom()?.$id ?? null;
        started.push({ id: trans.$id, redirectedFrom });

        if (started.length > 256) started.shift();

        if (redirectedFrom !== null) pendingRedirects.get(redirectedFrom)?.();
        emit({
          type: 'transition',
          id: trans.$id,
          from: trans.from().name ?? '',
          to: trans.to().name ?? '',
          fromParams: paramsOf(trans.params('from')),
          toParams: paramsOf(trans.params('to')),
          entering: names(changes.entering),
          exiting: names(changes.exiting),
          retained: names(changes.retained),
          redirectedFrom,
          options: optionsOf(trans),
          dynamic: trans.dynamic(),
        });
        trans.promise.then(
          () => settle(trans),
          // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a transition's rejection reason, which core types any
          (error: unknown) => settle(trans, error ?? 'rejected'),
        );
      },
      { priority: HIGH + 1 },
    ),
  );

  if (timeResolves)
    add(
      service.onStart(
        {},
        (trans) => {
          for (const node of trans.treeChanges('to'))
            timeResolvables(trans, node, now, emit);
        },
        { priority: HIGH },
      ),
    );

  bracket(service.onBefore, 'before');
  bracket(service.onStart, 'start');
  bracket(service.onExit, 'exit', { exiting: () => true });
  bracket(service.onRetain, 'retain', { retained: () => true });
  bracket(service.onEnter, 'enter', { entering: () => true });
  bracket(service.onFinish, 'finish');
  bracket(service.onSuccess, 'success');
  bracket(service.onError, 'error');

  add(service.onSuccess({}, emitCurrent, { priority: LOW }));
  add(router.stateRegistry.onStatesChanged(emitStates));
  // Returning undefined leaves core's onInvalid chain unchanged.
  add(
    router.stateService.onInvalid((to, from) => {
      emit({
        type: 'invalid',
        // name() returns the state object for the root state, whose name is empty.
        from: from?.$state()?.name ?? router.globals.current.name ?? '',
        to: to?.name() ?? '',
        toParams: paramsOf(to?.params() ?? {}),
      });

      return undefined;
    }),
  );

  return () => deregister.splice(0).forEach((fn) => fn());
};
