import {
  SpanStatusCode,
  type Attributes,
  type Context,
  type HrTime,
  type SpanContext,
  type SpanStatus,
} from '@opentelemetry/api';
import type {
  SpanAttributeValue,
  SpanRecord,
} from '@repo/router-events/schema';

/**
 * What the processor reads of a span: the part of the SDK's `ReadableSpan` that every SDK major shares, typed from
 * `@opentelemetry/api` alone. SDK 1.x names the parent by `parentSpanId`, later ones by `parentSpanContext`.
 */
export interface ProcessedSpan {
  readonly name: string;
  spanContext(): SpanContext;
  readonly parentSpanContext?: SpanContext;
  readonly parentSpanId?: string;
  readonly startTime: HrTime;
  readonly endTime: HrTime;
  readonly status: SpanStatus;
  readonly attributes: Attributes;
}

/** Where spans go: the `<ui-router-devtools>` element, or anything else with its `addSpan`. */
export interface SpanSink {
  addSpan(span: SpanRecord): void;
}

export interface DevtoolsSpanProcessorOptions {
  /** Send each span when it starts as well as when it ends, so a running span shows as running; on by default. */
  started?: boolean;
}

const STATUS: Record<SpanStatusCode, SpanRecord['status']> = {
  [SpanStatusCode.UNSET]: 'unset',
  [SpanStatusCode.OK]: 'ok',
  [SpanStatusCode.ERROR]: 'error',
};

const millis = ([seconds, nanos]: HrTime): number =>
  seconds * 1e3 + nanos / 1e6;

type Scalar = string | number | boolean;

const SCALARS: ReadonlySet<string> = new Set(['string', 'number', 'boolean']);

// The api types an attribute as AnyValue, which is unknown: scalars pass, and anything else is kept as text.
// oxlint-disable-next-line anti-slop/no-unknown-parameters -- AnyValue is unknown by the api's own contract
const isScalar = (value: unknown): value is Scalar =>
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the record holds JSON scalars, told apart by their type
  SCALARS.has(typeof value);

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- as above
const textOf = (value: unknown): string => {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- as above
const itemOf = (item: unknown): Scalar | null => {
  if (item === null || item === undefined) return null;

  return isScalar(item) ? item : textOf(item);
};

// oxlint-disable-next-line anti-slop/no-unknown-parameters -- as above
const valueOf = (value: unknown): SpanAttributeValue[] => {
  if (value === null || value === undefined) return [];

  if (Array.isArray(value)) return [value.map(itemOf)];

  return [isScalar(value) ? value : textOf(value)];
};

const attributesOf = (
  attributes: Attributes,
): Record<string, SpanAttributeValue> =>
  Object.fromEntries(
    Object.entries(attributes).flatMap(([key, value]) =>
      valueOf(value).map((kept) => [key, kept] as const),
    ),
  );

/** The span as the devtools panel reads it; without `ended` it has no `endTime`. */
export const spanRecordOf = (
  span: ProcessedSpan,
  ended: boolean,
): SpanRecord => {
  const { traceId, spanId } = span.spanContext();
  const parentSpanId = span.parentSpanContext?.spanId ?? span.parentSpanId;

  return {
    traceId,
    spanId,
    ...(parentSpanId && { parentSpanId }),
    name: span.name,
    startTime: millis(span.startTime),
    ...(ended && { endTime: millis(span.endTime) }),
    status: STATUS[span.status.code],
    attributes: attributesOf(span.attributes),
  };
};

/**
 * A span processor that sends every span to the devtools panel's Timeline. Add it to the tracer provider the
 * `OtelPlugin`'s tracer comes from, so the router's own spans reach the panel too: they are how it joins a span to
 * a transition. `sink` is asked for the panel on each span, so the panel may be created after the provider.
 */
export class DevtoolsSpanProcessor {
  readonly #sink: () => SpanSink | null | undefined;
  readonly #started: boolean;
  #stopped = false;

  constructor(
    sink: () => SpanSink | null | undefined,
    { started = true }: DevtoolsSpanProcessorOptions = {},
  ) {
    this.#sink = sink;
    this.#started = started;
  }

  onStart(span: ProcessedSpan, _parentContext?: Context): void {
    if (this.#started) this.#send(span, false);
  }

  onEnd(span: ProcessedSpan): void {
    this.#send(span, true);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  /** Stops sending; the provider calls it when it shuts down. */
  shutdown(): Promise<void> {
    this.#stopped = true;

    return Promise.resolve();
  }

  #send(span: ProcessedSpan, ended: boolean) {
    if (this.#stopped) return;

    this.#sink()?.addSpan(spanRecordOf(span, ended));
  }
}
