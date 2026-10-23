// The release diff a newly published version's page links, built before its first visitor asks.
import { isOnNpm, type VersionRow } from '@tools/release-ledger';
import { newestFirst, previousIn } from '@tools/release-ledger/versions';
import { Context, Effect, Option } from 'effect';

import { findVersions } from './ledger-sql.ts';

/** Two versions of one package, in the order `npm diff` compares them. */
export interface PrebuildPair {
  name: string;
  from: string;
  to: string;
}

/** Builds a pair's release diff into R2; the worker's layer hands it to the pair's ReleaseDiff object. */
export class DiffPrebuild extends Context.Service<
  DiffPrebuild,
  { build(pair: PrebuildPair): Effect.Effect<void, unknown> }
>()('release-ledger/DiffPrebuild') {}

/** `version` and the npm-published version before it, as its release page links them, or null for the first. */
export const prebuildPair = (
  rows: readonly VersionRow[],
  version: string,
): PrebuildPair | null => {
  const published = newestFirst(rows.filter(isOnNpm));
  const row = published.find((candidate) => candidate.version === version);
  const previous = row && previousIn(published, row);

  return row && previous
    ? { name: row.name, from: previous.version, to: row.version }
    : null;
};

/** Pre-builds the diff into `version` when a DiffPrebuild is provided; a failure is logged, never the claim's. */
export const prebuild = (name: string, version: string) =>
  Effect.gen(function* () {
    const service = yield* Effect.serviceOption(DiffPrebuild);

    if (Option.isNone(service)) return;

    const pair = prebuildPair(yield* findVersions({ name }), version);

    if (pair) yield* service.value.build(pair);
  }).pipe(
    Effect.catchCause((cause) =>
      Effect.logWarning(`release diff into ${name}@${version}`, cause),
    ),
  );
