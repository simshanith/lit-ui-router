// The release-ledger worker: `fetch` routes /claims to ingest, `scheduled`
// enqueues a sweep of every release tag, `queue` folds claims into D1, and
// LedgerReader serves reads over a service binding.
import { WorkerEntrypoint } from 'cloudflare:workers';
import { D1Client } from '@effect/sql-d1';
import { Effect, Layer, Option } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { createServerRouter } from 'ui-router-server';
import { createFetchHandler } from 'ui-router-server/fetch';

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

const routes = [
  { name: 'claims', url: '/claims', delegate: 'claims' },
] as const;

const router = createServerRouter({ mounts: { '/': { routes } } });

// A mount of delegating states only claims their urls; the rest pass as null.
const route = createFetchHandler(router, { delegates: { claims: ingest } });

const notFound = (): Response =>
  new Response('not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

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
}

export default {
  fetch: async (request, env, ctx) =>
    (await route(request, env, ctx)) ?? notFound(),
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
