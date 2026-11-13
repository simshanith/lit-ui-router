import type { PathNode, Transition } from '@uirouter/core';

import { messageOf } from './reasons.ts';
import type { ResolveEvent } from './schema.ts';

/** A resolve event before the adapter stamps its schema version and time. */
export type ResolveDraft = Omit<ResolveEvent, 'v' | 't'>;

// Opt-in monkey-patch: core has no resolve notification, so this wraps each per-transition Resolvable clone's resolveFn.
export const timeResolvables = (
  trans: Transition,
  node: PathNode,
  now: () => number,
  emit: (draft: ResolveDraft) => void,
): void => {
  for (const resolvable of node.resolvables) {
    const token: unknown = resolvable.token;

    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- core types tokens any; the app's resolves are the string tokens without a `$`
    if (typeof token !== 'string' || token.startsWith('$')) continue;

    const base = {
      type: 'resolve' as const,
      id: trans.$id,
      token,
      state: node.state.name,
    };

    if (resolvable.resolved) {
      const t = now();
      emit({ ...base, start: t, end: t, ok: true, cached: true });
      continue;
    }

    // SAFETY: core types `promise` as always set; it is undefined until the resolve starts
    if ((resolvable.promise as unknown) || !resolvable.resolveFn) continue;

    // SAFETY: a resolveFn takes its deps in order and returns a value or a promise
    // oxlint-disable-next-line anti-slop/no-unknown-returns -- the app's resolved value, which core types any
    const original = resolvable.resolveFn as (...deps: unknown[]) => unknown;
    resolvable.resolveFn = (...deps: unknown[]) => {
      const start = now();

      const done = (ok: boolean, message?: string) =>
        emit({ ...base, start, end: now(), ok, cached: false, message });

      try {
        const value: unknown = original(...deps);
        Promise.resolve(value).then(
          () => done(true),
          // oxlint-disable-next-line anti-slop/no-unknown-parameters -- a resolve's rejection reason, which the app types
          (error: unknown) => done(false, messageOf(error)),
        );

        return value;
      } catch (error) {
        done(false, messageOf(error));
        throw error;
      }
    };
  }
};
