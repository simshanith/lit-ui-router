import type { Span } from '@opentelemetry/api';
import type { StateObject, UIRouter } from '@uirouter/core';

import { runActive, type SpanEnds } from './active-span.ts';

/** Starts and ends the span a lazy load runs in; the reporter's, so the span is a child of its transition's. */
export interface LazyLoadSpans extends SpanEnds {
  startLazyLoad(id: number, state: string): Span | undefined;
}

type LazyLoad = StateObject['lazyLoad'];

// Before core's own lazy-load hook, which runs at priority 0.
const FIRST = Number.MAX_SAFE_INTEGER;

/**
 * Runs each state's `lazyLoad` with a `lazyLoad <state>` span active, so a span the app starts there is its child.
 * Core caches the load's promise on the function, so a transition that awaits a load already running gets no span.
 * Returns the disposer.
 */
export const activateLazyLoadSpans = (
  router: UIRouter,
  spans: LazyLoadSpans,
): (() => void) => {
  const wrapped = new Map<
    StateObject,
    [wrapper: LazyLoad, original: LazyLoad]
  >();

  // Opt-in monkey-patch: core calls `state.$$state().lazyLoad`, so the state object's own property is shadowed.
  const off = router.transitionService.onBefore(
    { entering: (state) => Boolean(state?.lazyLoad) },
    (trans) => {
      for (const { state } of trans.treeChanges('entering')) {
        const original = state.lazyLoad;

        if (!original || wrapped.get(state)?.[0] === original) continue;

        const wrapper: LazyLoad = (transition, declaration) => {
          const span = spans.startLazyLoad(transition.$id, state.name);

          return span
            ? runActive(span, spans, () => original(transition, declaration))
            : original(transition, declaration);
        };

        wrapped.set(state, [wrapper, original]);
        state.lazyLoad = wrapper;
      }
    },
    { priority: FIRST },
  );

  return () => {
    // SAFETY: core types every hook deregistration as Function; it takes no arguments
    (off as () => void)();

    // A load in flight keeps its wrapper, on which core caches the promise; it passes through once the reporter is disposed.
    for (const [state, [wrapper, original]] of wrapped)
      if (state.lazyLoad === wrapper && !('_promise' in wrapper))
        state.lazyLoad = original;
    wrapped.clear();
  };
};
