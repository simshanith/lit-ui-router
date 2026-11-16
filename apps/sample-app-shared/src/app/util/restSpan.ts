import { SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';

export type RestVerb = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Runs a simulated REST request in a span named `<verb> <resource>`. The span starts synchronously, so a request
 * made in a resolve is that resolve's child, and ends when the request settles.
 */
export function restSpan<T>(
  verb: RestVerb,
  resource: string,
  request: () => Promise<T>,
): Promise<T> {
  // Looked up per call: the global tracer is a no-op until the telemetry chunk registers a provider.
  const span = trace
    .getTracer('sample-app-shared')
    .startSpan(`${verb} ${resource}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.request.method': verb,
        'sample_app.resource': resource,
      },
    });

  // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a rejection reason is unknown by the Promise contract
  const fail = (error: unknown): never => {
    span.setAttribute(
      'error.type',
      error instanceof Error ? error.name : '_OTHER',
    );
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();

    throw error;
  };

  try {
    return request().then((value) => {
      span.end();

      return value;
    }, fail);
  } catch (error) {
    return fail(error);
  }
}
