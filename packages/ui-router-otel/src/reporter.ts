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
import { redactionOf } from '@repo/router-events/redaction';
import { errorNameOf, messageOf } from '@repo/router-events/thrown';
import type {
  InvalidEvent,
  Outcome,
  Params,
  PhaseEvent,
  Redaction,
  ResolveEvent,
  ResultEvent,
  RouterEvent,
  TransitionEvent,
} from '@repo/router-events/schema';

// Every target runtime has it; declared here so the module compiles without DOM or node types.
declare const performance: { readonly timeOrigin: number; now(): number };

export interface ReportOptions {
  /**
   * What reaches a span, in the devtools export's shape: only the params `params` lists (`'all'` for every one)
   * become `uirouter.param.<key>` attributes, and the rest are omitted rather than redacted; `messages: false` keeps
   * error messages out of span status and exception events. By default no param is kept and messages are.
   */
  redaction?: Partial<Redaction>;
  /** Report transitions core ignores as a no-op (same state and params); off by default. */
  includeIgnored?: boolean;
}

export interface TracerReporter {
  /** Feeds one adapter event to the reporter. */
  report(event: RouterEvent): void;
  /** Starts a resolve's span now, as a child of its transition's span; none when the transition is not known. */
  startResolve(id: number, token: string, state: string): Span | undefined;
  /** Ends a span `startResolve` started. */
  endResolve(span: Span): void;
  /** Ends a span `startResolve` started as failed: its resolve threw or rejected with `error`. */
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a resolve's rejection reason, which the app types
  failResolve(span: Span, error: unknown): void;
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

// The semantic conventions' value for an error with no better type.
const OTHER = '_OTHER';

const at = (t: number): number => performance.timeOrigin + t;

// An attribute value is a scalar or a homogeneous array, so a list param becomes strings.
const paramAttributes = (
  params: Params,
  keep: Redaction['params'],
): Attributes =>
  Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      if (value === null || (keep !== 'all' && !keep.includes(key))) return [];

      return [
        [
          `uirouter.param.${key}`,
          Array.isArray(value) ? value.map(String) : value,
        ],
      ];
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
  keep: Redaction['params'],
): Attributes => ({
  'uirouter.transition_id': id,
  'uirouter.from': from,
  'uirouter.to': to,
  'uirouter.source': options.source,
  'uirouter.reload': options.reload !== false,
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the schema's own union: a flag or the reloaded state's name
  ...(typeof options.reload === 'string' && {
    'uirouter.reload_state': options.reload,
  }),
  'uirouter.location': String(options.location),
  'uirouter.entering': entering,
  'uirouter.exiting': exiting,
  'uirouter.retained': retained,
  ...paramAttributes(toParams, keep),
});

const resultAttributes = ({
  outcome,
  errorName,
  invalidParams,
}: Pick<
  ResultEvent,
  'outcome' | 'errorName' | 'invalidParams'
>): Attributes => ({
  'uirouter.outcome': outcome,
  ...(invalidParams && { 'uirouter.invalid_params': invalidParams }),
  ...(outcome === 'invalid' && { 'error.type': 'invalid' }),
  ...(outcome === 'error' && { 'error.type': errorName ?? OTHER }),
});

const resolveAttributes = (token: string, state: string): Attributes => ({
  'uirouter.resolve': token,
  'uirouter.state': state,
});

const phaseKey = ({ phase, state }: PhaseEvent): string =>
  state ? `${phase} ${state}` : phase;

/** Turns the adapter's event stream into spans on `tracer`; feed it with `report`. */
export const reportToTracer = (
  tracer: Tracer,
  { redaction, includeIgnored = false }: ReportOptions = {},
): TracerReporter => {
  const { params, messages } = redactionOf(redaction);
  const txs = new Map<number, Tx>();

  const fail = (span: Span, message: string | undefined, t: number) => {
    const description = messages ? message : undefined;
    span.setStatus({ code: SpanStatusCode.ERROR, message: description });

    if (description) span.recordException({ message: description }, at(t));
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
      'uirouter.phase': start.phase,
      ...(start.state && { 'uirouter.state': start.state }),
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

    const span = childOf(
      tx,
      `resolve ${event.token}`,
      event.start,
      resolveAttributes(event.token, event.state),
    );

    if (!event.ok) {
      span.setAttribute('error.type', event.errorName ?? OTHER);
      fail(span, event.message, event.end);
    }

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
    span.setAttributes(resultAttributes(event));

    // The successor of a redirect links back at its start; a superseded transition links forward to its superseder.
    const superseder =
      event.outcome === 'superseded' && event.by !== undefined
        ? txs.get(event.by)
        : undefined;

    if (superseder) span.addLink({ context: spanOf(superseder).spanContext() });

    if (ERRORS.has(event.outcome)) fail(span, event.message, event.t);
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
          'uirouter.from': event.from,
          'uirouter.to': event.to,
          ...resultAttributes({ outcome: 'invalid' }),
          ...paramAttributes(event.toParams, params),
        },
      },
      context.active(),
    );

    fail(span, `No state named '${event.to}'`, event.t);
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
    startResolve: (id, token, state) => {
      const tx = txs.get(id);

      return tx && !tx.settled
        ? childOf(
            tx,
            `resolve ${token}`,
            performance.now(),
            resolveAttributes(token, state),
          )
        : undefined;
    },
    endResolve: (span) => span.end(at(performance.now())),
    failResolve: (span, error) => {
      const t = performance.now();

      span.setAttribute('error.type', errorNameOf(error) ?? OTHER);
      fail(span, messageOf(error), t);
      span.end(at(t));
    },
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
