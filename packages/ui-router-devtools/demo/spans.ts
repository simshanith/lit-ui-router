import type {
  ResolvableLiteral,
  StateDeclaration,
  UIRouter,
} from '@uirouter/core';
import type { SpanRecord } from '../src/schema.ts';

interface SpanSink {
  addSpan(span: SpanRecord): void;
}

const hex = (length: number): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(length / 2)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

const now = (): number => performance.timeOrigin + performance.now();

/**
 * Sends the panel what an instrumented app would: ui-router-otel's span for each transition, and a fetch span for
 * each resolve. The `stars` resolve is sent as `activateResolveSpans` sends it, with a resolve span its fetch is a
 * child of; the other fetches start traces of their own, as they do with the option off.
 */
export const demoTracing = (router: UIRouter, sink: SpanSink) => {
  let active: SpanRecord | undefined;

  const begin = (
    name: string,
    parent: SpanRecord | undefined,
    attributes: SpanRecord['attributes'] = {},
  ): SpanRecord => {
    const span: SpanRecord = {
      traceId: parent?.traceId ?? hex(32),
      spanId: hex(16),
      ...(parent && { parentSpanId: parent.spanId }),
      name,
      startTime: now(),
      attributes,
    };

    sink.addSpan(span);

    return span;
  };

  const end = (span: SpanRecord, status: SpanRecord['status'] = 'unset') =>
    sink.addSpan({ ...span, endTime: now(), status });

  router.transitionService.onBefore({}, (trans) => {
    const span = begin(trans.to().name ?? '', undefined, {
      'uirouter.transition_id': trans.$id,
      'uirouter.from': trans.from().name ?? '',
      'uirouter.to': trans.to().name ?? '',
    });

    active = span;
    trans.promise.then(
      () => end(span),
      () => end(span),
    );
  });

  // A fetch, with a short parse of its body at the end as its child.
  const fetched = async <T>(token: string, load: () => Promise<T>) => {
    const resolve =
      token === 'stars' && active
        ? begin(`resolve ${token}`, active, { 'uirouter.resolve': token })
        : undefined;

    const fetch = begin(`GET /api/${token}`, resolve, {
      'http.request.method': 'GET',
      'url.full': `https://api.example.test/${token}?session=demo`,
    });

    try {
      const value = await load();
      const parse = begin('parse JSON', fetch);

      end({ ...parse, startTime: parse.startTime - 3 });
      end(fetch);

      if (resolve) end(resolve);

      return value;
    } catch (error) {
      end(fetch, 'error');

      if (resolve) end(resolve, 'error');
      throw error;
    }
  };

  const traced = (resolve: ResolvableLiteral): ResolvableLiteral => {
    // SAFETY: core types resolveFn as Function; the demo's resolves take their deps and return a value or a promise
    const load = resolve.resolveFn as (
      ...deps: never[]
    ) => Promise<object | null | undefined>;

    return {
      ...resolve,
      resolveFn: (...deps: never[]) =>
        fetched(String(resolve.token), () => Promise.resolve(load(...deps))),
    };
  };

  return <S extends StateDeclaration>(state: S): S =>
    Array.isArray(state.resolve)
      ? {
          ...state,
          // SAFETY: the demo's states declare every resolve as a literal with a token
          resolve: (state.resolve as ResolvableLiteral[]).map(traced),
        }
      : state;
};
