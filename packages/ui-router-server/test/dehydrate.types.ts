import type { Transition } from '@uirouter/core';

import { dehydrate } from '../src/ssr.ts';
import type {
  DehydrateCandidate,
  DehydrateOptions,
  DehydrateResult,
} from '../src/ssr.ts';

// Pure type-level: the `.types.ts` name keeps it out of the node --test glob; the compile is the assertion.

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

declare const transition: Transition;

// The options object is optional, and so is the predicate within it.
export const bare: DehydrateResult = dehydrate(transition);

export const empty: DehydrateResult = dehydrate(transition, {});

export const options: DehydrateOptions = {
  shouldDehydrate: ({ state, token, value }) => {
    const typed: [
      Equal<typeof state, string>,
      Equal<typeof token, string>,
      Equal<typeof value, unknown>,
    ] = [true, true, true];

    void typed;

    return true;
  },
};

// The candidate names a resolve the way an `unserializable` entry does.
export const sameKey: Equal<
  Pick<DehydrateCandidate, 'state' | 'token'>,
  DehydrateResult['unserializable'][number]
> = true;

// @ts-expect-error the predicate answers with a boolean, not a truthy value
export const truthy: DehydrateOptions = { shouldDehydrate: () => 'yes' };
