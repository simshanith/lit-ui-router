import type { Span } from '@opentelemetry/api';
import type { PathNode, Resolvable, UIRouter } from '@uirouter/core';

import { runActive, type SpanEnds } from './active-span.ts';

/** Starts and ends the span a resolve runs in; the reporter's, so the span is a child of its transition's. */
export interface ResolveSpans extends SpanEnds {
  startResolve(id: number, token: string, state: string): Span | undefined;
}

// Before core's own resolve hooks, which run at priority 1000.
const FIRST = Number.MAX_SAFE_INTEGER;

// The resolves each reporter has wrapped, so activating it twice wraps a resolve once; two reporters each wrap it.
const wrappedBy = new WeakMap<ResolveSpans, WeakSet<Resolvable>>();

// Opt-in monkey-patch: core has no resolve notification, so each per-transition Resolvable clone's resolveFn is wrapped.
const wrap = (
  id: number,
  node: PathNode,
  resolvable: Resolvable,
  spans: ResolveSpans,
) => {
  const token: unknown = resolvable.token;

  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- core types tokens any; the app's resolves are the string tokens without a `$`
  if (typeof token !== 'string' || token.startsWith('$')) return;

  // SAFETY: a resolveFn takes its deps in order and returns a value or a promise
  // oxlint-disable-next-line anti-slop/no-unknown-returns -- the app's resolved value, which core types any
  const original = resolvable.resolveFn as (...deps: unknown[]) => unknown;

  resolvable.resolveFn = (...deps: unknown[]) => {
    const span = spans.startResolve(id, token, node.state.name);

    return span
      ? runActive(span, spans, () => original(...deps))
      : original(...deps);
  };
};

/**
 * Runs each resolve's function with the resolve's span as the active span, so a span the app starts there is its
 * child. What follows an `await` keeps it only under a context manager that follows async work. Returns the disposer.
 */
export const activateResolveSpans = (
  router: UIRouter,
  spans: ResolveSpans,
): (() => void) => {
  const wrapped = wrappedBy.get(spans) ?? new WeakSet<Resolvable>();

  wrappedBy.set(spans, wrapped);

  const off = router.transitionService.onStart(
    {},
    (trans) => {
      for (const node of trans.treeChanges('to'))
        for (const resolvable of node.resolvables) {
          // SAFETY: core types `promise` as always set; it is undefined until the resolve starts
          const started = resolvable.promise as unknown;

          if (
            wrapped.has(resolvable) ||
            resolvable.resolved ||
            started ||
            !resolvable.resolveFn
          )
            continue;

          wrapped.add(resolvable);
          wrap(trans.$id, node, resolvable, spans);
        }
    },
    { priority: FIRST },
  );

  // SAFETY: core types every hook deregistration as Function; it takes no arguments
  return off as () => void;
};
