// The release-ledger worker: `fetch` enqueues verified claims, `scheduled`
// enqueues a sweep of every release tag, `queue` folds claims into D1, and
// LedgerReader serves reads over a service binding.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { D1Client } from '@effect/sql-d1';
import { makeCloudflareTracer } from 'cloudflare-effect-tracer';
import { Effect, Layer, Option, Tracer } from 'effect';
import { FetchHttpClient } from 'effect/http';

import type { Claim } from '../src/claim.ts';
import { consume } from '../src/consume.ts';
import { respond } from '../src/ingest.ts';
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

/** Runs one invocation under a span in the Workers trace; the tracer is per invocation. */
const run = <A, E>(name: string, effect: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.withSpan(name),
      Effect.provideService(Tracer.Tracer, makeCloudflareTracer()),
    ),
  );

/** Read-only access for other workers; a D1 binding would grant writes too. */
export class LedgerReader extends WorkerEntrypoint<LedgerEnv> {
  /** The version a dist-tag points at, with its derived states, or null. */
  tagged(name: string, tag: string): Promise<LedgerVersion | null> {
    return run(
      'ledger.reader.tagged',
      findTagged({ name, tag }).pipe(
        Effect.map(Option.getOrNull),
        Effect.provide(database(this.env)),
      ),
    );
  }

  /** Every recorded version of a package with its derived states, oldest first. */
  versions(name: string): Promise<readonly LedgerVersion[]> {
    return run(
      'ledger.reader.versions',
      findVersions({ name }).pipe(Effect.provide(database(this.env))),
    );
  }

  /** Every package with a recorded version, by name, each with its `latest` row or null. */
  packages(): Promise<readonly LedgerPackage[]> {
    return run(
      'ledger.reader.packages',
      findPackages.pipe(Effect.provide(database(this.env))),
    );
  }
}

export default {
  fetch: (request, env) => run('ledger.fetch', respond(request, env)),
  scheduled: (controller, env) =>
    run(
      'ledger.sweep',
      sweep(env, {
        cron: controller.cron,
        scheduledAt: new Date(controller.scheduledTime).toISOString(),
      }).pipe(Effect.provide(FetchHttpClient.layer)),
    ),
  queue: (batch, env) =>
    run(
      'ledger.consume',
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
