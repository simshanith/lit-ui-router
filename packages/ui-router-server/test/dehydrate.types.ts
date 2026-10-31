import type { Transition } from '@uirouter/core';

import type { SeedOptions } from '../src/ssr-client.ts';
import { dehydrate } from '../src/ssr.ts';
import type {
  DehydrateCandidate,
  DehydrateOptions,
  DehydrateResult,
  Transporter,
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

const DateTransporter: Transporter<Date> = {
  encode: (value) => value instanceof Date && value.toISOString(),
  // SAFETY: encode writes an ISO string.
  decode: (encoded) => new Date(encoded as string),
};

// One transport record fits both sides, a typed transporter among untyped ones.
export const transport = { Date: DateTransporter };

export const withTransport: [DehydrateOptions, SeedOptions] = [
  { transport },
  { transport },
];

export const decoded: Equal<
  ReturnType<typeof DateTransporter.decode>,
  Date
> = true;

export const loose: Transporter = {
  ...DateTransporter,
  // @ts-expect-error encode answers with JSON data or a falsy value, not a Date
  encode: () => new Date(),
};

export const mistyped: Transporter<Date> = {
  ...DateTransporter,
  // @ts-expect-error decode answers with the transporter's own type
  decode: String,
};
