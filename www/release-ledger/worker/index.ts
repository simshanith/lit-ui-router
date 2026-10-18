// The release-ledger worker: `fetch` enqueues verified claims, `scheduled`
// enqueues a sweep of every release tag, `queue` folds claims into D1, and
// LedgerReader serves reads over a service binding.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { D1Client } from '@effect/sql-d1';
import { Effect, Layer, Option } from 'effect';

import type { Claim } from '../src/claim.ts';
import { consume } from '../src/consume.ts';
import { ingest } from '../src/ingest.ts';
import {
  findTagged,
  findVersions,
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
}

export default {
  fetch: (request, env) => ingest(request, env),
  scheduled: (controller, env) =>
    Effect.runPromise(
      sweep(env, {
        cron: controller.cron,
        scheduledAt: new Date(controller.scheduledTime).toISOString(),
      }),
    ),
  queue: (batch, env) =>
    Effect.runPromise(
      consume(batch).pipe(
        Effect.provide(Layer.mergeAll(database(env), ObserverLive(env))),
      ),
    ),
} satisfies ExportedHandler<LedgerEnv, Claim>;
