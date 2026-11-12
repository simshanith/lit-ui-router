import {
  context,
  SpanKind,
  SpanStatusCode,
  trace,
  type Attributes,
  type Context,
  type Link,
  type Span,
  type Tracer,
} from '@opentelemetry/api';
import type {
  InvalidEvent,
  Outcome,
  Params,
  PhaseEvent,
  ResolveEvent,
  ResultEvent,
  RouterEvent,
  TransitionEvent,
} from '@repo/router-events/schema';

// Every target runtime has it; declared here so the module compiles without DOM or node types.
declare const performance: { readonly timeOrigin: number };

export interface ReportOptions {
  /** Param keys recorded as `ui_router.param.<key>` on the transition span; none by default. */
  params?: readonly string[];
  /** Maps an error message before it reaches a span's status and exception event; return `undefined` to drop it. */
  errorMessage?: (message: string) => string | undefined;
  /** Report transitions core ignores as a no-op (same state and params); off by default. */
  includeIgnored?: boolean;
}

export interface TracerReporter {
  /** Feeds one adapter event to the reporter. */
  report(event: RouterEvent): void;
  /** Ends every span still open and stops reporting. */
  dispose(): void;
}

interface Tx {
  start: TransitionEvent;
  // The context active when the transition started, which parents its span.
  parent: Context;
  span?: Span;
  open: Map<string, PhaseEvent>;
  // Phases that ended before the transition passed onBefore, where core may still ignore it.
  held: [start: PhaseEvent, end: number][] | null;
  settled: boolean;
}

// Settled transitions kept for late resolves and redirect links.
const KEEP = 64;

const ERRORS = new Set<Outcome>(['error', 'invalid']);

// Core's RejectType for each outcome; redirected and superseded share SUPERSEDED.
const REJECTION: Partial<Record<Outcome, string>> = {
  redirected: 'superseded',
  superseded: 'superseded',
  aborted: 'aborted',
  invalid: 'invalid',
  ignored: 'ignored',
  error: 'error',
};

const at = (t: number): number => performance.timeOrigin + t;

const paramAttributes = (
  params: Params,
  allowed: readonly string[],
): Attributes =>
  Object.fromEntries(
    allowed.flatMap((key) => {
      const value = params[key];

      return value === undefined || value === null
        ? []
        : [[`ui_router.param.${key}`, value]];
    }),
  );

const transitionAttributes = (
  {
    id,
    from,
    to,
    options,
    entering,
    exiting,
    retained,
    toParams,
  }: TransitionEvent,
  allowed: readonly string[],
): Attributes => ({
  'ui_router.transition_id': id,
  'ui_router.from': from,
  'ui_router.to': to,
  'ui_router.source': options.source,
  'ui_router.reload': options.reload !== false,
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the schema's own union: a flag or the reloaded state's name
  ...(typeof options.reload === 'string' && {
    'ui_router.reload_state': options.reload,
  }),
  'ui_router.location': String(options.location),
  'ui_router.entering': entering,
  'ui_router.exiting': exiting,
  'ui_router.retained': retained,
  ...paramAttributes(toParams, allowed),
});

const outcomeAttributes = (outcome: Outcome): Attributes => {
  const rejection = REJECTION[outcome];

  return {
    'ui_router.outcome': outcome,
    ...(rejection && { 'ui_router.rejection_type': rejection }),
  };
};

const phaseKey = ({ phase, state }: PhaseEvent): string =>
  state ? `${phase} ${state}` : phase;

/** Turns the adapter's event stream into spans on `tracer`; feed it with `report`. */
export const reportToTracer = (
  tracer: Tracer,
  {
    params = [],
    errorMessage = (message) => message,
    includeIgnored = false,
  }: ReportOptions = {},
): TracerReporter => {
  const txs = new Map<number, Tx>();

  const fail = (span: Span, message: string, t: number) => {
    const mapped = errorMessage(message);
    span.setStatus({ code: SpanStatusCode.ERROR, message: mapped });

    if (mapped) span.recordException({ message: mapped }, at(t));
  };

  // Created on first need, so a transition core ignores in onBefore leaves no span.
  const spanOf = (tx: Tx): Span => {
    if (tx.span) return tx.span;

    const { redirectedFrom } = tx.start;

    const origin =
      redirectedFrom === null ? undefined : txs.get(redirectedFrom);

    const links: Link[] = origin
      ? [{ context: spanOf(origin).spanContext() }]
      : [];

    tx.span = tracer.startSpan(
      tx.start.to,
      {
        kind: SpanKind.INTERNAL,
        startTime: at(tx.start.t),
        attributes: transitionAttributes(tx.start, params),
        links,
      },
      tx.parent,
    );

    const held = tx.held ?? [];
    tx.held = null;

    for (const [start, end] of held) phaseSpan(tx, start).end(at(end));

    return tx.span;
  };

  const childOf = (
    tx: Tx,
    name: string,
    start: number,
    attributes: Attributes,
  ): Span =>
    tracer.startSpan(
      name,
      { kind: SpanKind.INTERNAL, startTime: at(start), attributes },
      trace.setSpan(tx.parent, spanOf(tx)),
    );

  const phaseSpan = (tx: Tx, start: PhaseEvent): Span =>
    childOf(tx, phaseKey(start), start.t, {
      'ui_router.phase': start.phase,
      ...(start.state && { 'ui_router.state': start.state }),
    });

  // A phase cut short by a redirect, a supersede or dispose() ends with it.
  const endOpen = (tx: Tx, t?: number) => {
    for (const start of tx.open.values())
      phaseSpan(tx, start).end(t === undefined ? undefined : at(t));
    tx.open.clear();
  };

  const onPhase = (tx: Tx, event: PhaseEvent) => {
    const key = phaseKey(event);

    if (event.edge === 'start') {
      tx.open.set(key, event);

      return;
    }

    const start = tx.open.get(key);

    if (!start) return;
    tx.open.delete(key);

    // The before phase ends after core's ignore check, so only then is the transition sure to run.
    if (tx.held && event.phase !== 'before') tx.held.push([start, event.t]);
    else phaseSpan(tx, start).end(at(event.t));
  };

  const onResolve = (tx: Tx, event: ResolveEvent) => {
    if (event.cached) return;

    const span = childOf(tx, `resolve ${event.token}`, event.start, {
      'ui_router.resolve': event.token,
      'ui_router.state': event.state,
    });

    if (!event.ok) fail(span, event.message ?? '', event.end);
    span.end(at(event.end));
  };

  const prune = () => {
    for (const [id, tx] of txs) {
      if (txs.size <= KEEP) return;

      if (tx.settled) txs.delete(id);
    }
  };

  const onResult = (tx: Tx, event: ResultEvent) => {
    tx.settled = true;

    if (event.outcome === 'ignored' && !includeIgnored && !tx.span) {
      txs.delete(event.id);

      return;
    }

    const span = spanOf(tx);
    endOpen(tx, event.t);
    span.setAttributes(outcomeAttributes(event.outcome));

    if (ERRORS.has(event.outcome)) fail(span, event.message ?? '', event.t);
    span.end(at(event.t));
    prune();
  };

  // A target that names no state never becomes a Transition; it gets a zero-length span of its own.
  const onInvalid = (event: InvalidEvent) => {
    const span = tracer.startSpan(
      'invalid target',
      {
        kind: SpanKind.INTERNAL,
        startTime: at(event.t),
        attributes: {
          'ui_router.from': event.from,
          'ui_router.to': event.to,
          ...outcomeAttributes('invalid'),
          ...paramAttributes(event.toParams, params),
        },
      },
      context.active(),
    );

    fail(span, event.reason, event.t);
    span.end(at(event.t));
  };

  const onTransitionEvent = (
    event: PhaseEvent | ResolveEvent | ResultEvent,
  ) => {
    const tx = txs.get(event.id);

    if (!tx) return;

    if (event.type === 'phase') onPhase(tx, event);
    else if (event.type === 'resolve') onResolve(tx, event);
    else onResult(tx, event);
  };

  return {
    report: (event) => {
      if (event.type === 'transition')
        txs.set(event.id, {
          start: event,
          parent: context.active(),
          open: new Map(),
          held: [],
          settled: false,
        });
      else if (event.type === 'invalid') onInvalid(event);
      else if (
        event.type === 'phase' ||
        event.type === 'resolve' ||
        event.type === 'result'
      )
        onTransitionEvent(event);
    },
    dispose: () => {
      for (const tx of txs.values()) {
        if (tx.settled) continue;
        const span = spanOf(tx);
        endOpen(tx);
        span.end();
      }

      txs.clear();
    },
  };
};
