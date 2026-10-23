// The release-ledger worker: `fetch` enqueues verified claims, `scheduled`
// enqueues a sweep of every release tag, `queue` folds claims into D1,
// LedgerReader serves reads over a service binding, among them each version
// pair's release diff, built once by that pair's ReleaseDiff object.
import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers';
import { D1Client } from '@effect/sql-d1';
import { DiffEntry, type DiffPair, objectName } from '@tools/npm-diff';
import type { DiffIndex } from '@tools/npm-diff/diff-index';
import { Effect, Layer, Option } from 'effect';
import { FetchHttpClient } from 'effect/http';

import type { Claim } from '../src/claim.ts';
import { consume } from '../src/consume.ts';
import { ingest } from '../src/ingest.ts';
import {
  findPackages,
  findTagged,
  findVersions,
  type LedgerPackage,
  type LedgerVersion,
} from '../src/ledger-sql.ts';
import { ObserverLive } from '../src/observe.ts';
import { sweep } from '../src/sweep.ts';

/** Secrets and local flags `wrangler types` cannot see in wrangler.jsonc. */
type LedgerEnv = Env & {
  GITHUB_TOKEN?: string;
  LEDGER_DEV_SKIP_OIDC?: string;
};

const database = (env: LedgerEnv) => D1Client.layer({ db: env.DB });

/** The `ReleaseDiff` object that owns a pair. */
const releaseDiffObject = (env: LedgerEnv, pair: DiffPair) =>
  env.RELEASE_DIFF.get(env.RELEASE_DIFF.idFromName(objectName(pair)));

/** Read-only access for other workers; a D1 binding would grant writes too. */
export class LedgerReader extends WorkerEntrypoint<LedgerEnv> {
  /** The version a dist-tag points at, with its derived states, or null. */
  tagged(name: string, tag: string): Promise<LedgerVersion | null> {
    return Effect.runPromise(
      findTagged({ name, tag }).pipe(
        Effect.map(Option.getOrNull),
        Effect.provide(database(this.env)),
      ),
    );
  }

  /** Every recorded version of a package with its derived states, oldest first. */
  versions(name: string): Promise<readonly LedgerVersion[]> {
    return Effect.runPromise(
      findVersions({ name }).pipe(Effect.provide(database(this.env))),
    );
  }

  /** Every package with a recorded version, by name, each with its `latest` row or null. */
  packages(): Promise<readonly LedgerPackage[]> {
    return Effect.runPromise(
      findPackages.pipe(Effect.provide(database(this.env))),
    );
  }

  /** A version pair's release diff index, which the pair's `ReleaseDiff` object builds once into R2; the caller validates the pair, since each pair names an object. */
  releaseDiff(pair: DiffPair): Promise<DiffIndex> {
    return releaseDiffObject(this.env, pair).index(pair);
  }
}

/**
 * One version pair's diff, named by `objectName`. R2 holds the entry, so the object stores nothing and
 * goes idle once a call returns; it only keeps a build to one at a time.
 */
export class ReleaseDiff extends DurableObject<LedgerEnv> {
  readonly #entries = new Map<string, DiffEntry>();

  #entryOf(pair: DiffPair): DiffEntry {
    const name = objectName(pair);

    const entry =
      this.#entries.get(name) ?? new DiffEntry(this.env.RELEASE_DIFFS, pair);

    this.#entries.set(name, entry);

    return entry;
  }

  /** Builds the pair's entry, from the npm registry's tarballs, unless R2 holds it; returns its index. */
  build(pair: DiffPair): Promise<DiffIndex> {
    return this.#entryOf(pair).index();
  }

  /** The pair's index, built on a miss. */
  index(pair: DiffPair): Promise<DiffIndex> {
    return this.#entryOf(pair).index();
  }

  /** The patch sections of the files at `paths`, in patch order, built on a miss. */
  files(pair: DiffPair, paths: readonly string[]): Promise<string> {
    return this.#entryOf(pair).files(paths);
  }

  /** The whole patch `npm diff` prints, built on a miss. */
  patch(pair: DiffPair): Promise<ReadableStream<Uint8Array>> {
    return this.#entryOf(pair).patch();
  }
}

export default {
  fetch: (request, env) => ingest(request, env),
  scheduled: (controller, env) =>
    Effect.runPromise(
      sweep(env, {
        cron: controller.cron,
        scheduledAt: new Date(controller.scheduledTime).toISOString(),
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    ),
  queue: (batch, env) =>
    Effect.runPromise(
      consume(batch).pipe(
        Effect.provide(
          Layer.mergeAll(
            database(env),
            ObserverLive(env).pipe(Layer.provide(FetchHttpClient.layer)),
          ),
        ),
      ),
    ),
} satisfies ExportedHandler<LedgerEnv, Claim>;
