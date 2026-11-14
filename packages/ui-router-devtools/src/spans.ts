import type { Tx } from './fold.ts';
import type { SpanRecord } from './schema.ts';

/** How many spans the panel keeps; past it the oldest go first. */
export const SPAN_LIMIT = 2000;

/** Adds `span` to `spans` in place, replacing the record with its `spanId`, so a started span is replaced when it ends. */
export const upsertSpan = (
  spans: Map<string, SpanRecord>,
  span: SpanRecord,
  limit: number = SPAN_LIMIT,
): void => {
  spans.delete(span.spanId);
  spans.set(span.spanId, span);

  for (const key of spans.keys()) {
    if (spans.size <= limit) break;
    spans.delete(key);
  }
};

export interface SpanWindow {
  start: number;
  end: number;
}

/** Where a span sits on the event clock, from its epoch times; a running span ends at `clock`. */
export const spanWindow = (
  span: SpanRecord,
  timeOrigin: number,
  clock: number,
): SpanWindow => ({
  start: span.startTime - timeOrigin,
  end: span.endTime === undefined ? clock : span.endTime - timeOrigin,
});

/** The spans that overlap any transition's run, which is what a session file keeps of them. */
export const spansDuring = (
  spans: readonly SpanRecord[],
  txs: readonly Tx[],
  timeOrigin: number,
  clock: number,
): SpanRecord[] => {
  const runs = txs.flatMap((tx) =>
    tx.id < 0 ? [] : [{ start: tx.t, end: tx.result?.t ?? clock }],
  );

  return spans.filter((span) => {
    const { start, end } = spanWindow(span, timeOrigin, clock);

    return runs.some((run) => start <= run.end && end >= run.start);
  });
};
