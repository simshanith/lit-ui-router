import { context, trace, type Span } from '@opentelemetry/api';

/** Ends a span the plugin started around an app function, as done or as failed. */
export interface SpanEnds {
  endSpan(span: Span): void;
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a rejection reason, which the app types
  failSpan(span: Span, error: unknown): void;
}

/** Runs `fn` with `span` active and returns what it returns; the span ends when that value settles. */
export const runActive = <T>(span: Span, ends: SpanEnds, fn: () => T): T => {
  // A function may throw or reject with nothing; its span still fails, as the adapter's resolve timing does.
  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a rejection reason, which the app types
  const failed = (error: unknown) => ends.failSpan(span, error ?? 'rejected');

  try {
    const value = context.with(trace.setSpan(context.active(), span), fn);

    Promise.resolve(value).then(() => ends.endSpan(span), failed);

    return value;
  } catch (error) {
    failed(error);
    throw error;
  }
};
