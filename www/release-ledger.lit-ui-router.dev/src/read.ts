// GET /ledger: the versions and dist-tags for the release-signals reconcile
// check, behind a read policy that shares nothing with /claims but the pins.
import { Effect } from 'effect';
import type { JWTVerifyGetKey } from 'jose';

import { authenticate, text } from './ingest.ts';
import type { LedgerSnapshot } from './ledger-sql.ts';
import { ForbiddenClaim, runForbiddenReason } from './oidc.ts';

export interface ReadEnv {
  OIDC_READ_AUDIENCE?: string;
  OIDC_REPOSITORY: string;
  OIDC_REPOSITORY_ID: string;
  OIDC_REPOSITORY_OWNER_ID: string;
  OIDC_READ_WORKFLOWS: readonly string[];
  LEDGER_DEV_SKIP_OIDC?: string;
}

/** The read token's verified claims, its run pins checked; no body is needed. */
export const authorizeRead = (
  request: Request,
  env: ReadEnv,
  keys?: JWTVerifyGetKey,
) =>
  Effect.gen(function* () {
    const claims = yield* authenticate(
      request,
      {
        variable: 'OIDC_READ_AUDIENCE',
        audience: env.OIDC_READ_AUDIENCE,
        devSkip: env.LEDGER_DEV_SKIP_OIDC,
      },
      keys,
    );

    const forbidden = runForbiddenReason(claims, {
      repository: env.OIDC_REPOSITORY,
      repositoryId: env.OIDC_REPOSITORY_ID,
      repositoryOwnerId: env.OIDC_REPOSITORY_OWNER_ID,
      workflows: env.OIDC_READ_WORKFLOWS,
    });

    if (forbidden !== undefined) {
      return yield* new ForbiddenClaim({
        reason: `${forbidden} is not allowed`,
      });
    }

    return claims;
  });

/** Answers GET /ledger once the caller is authorized. */
export const readSnapshot = (
  snapshot: Effect.Effect<LedgerSnapshot, unknown>,
): Effect.Effect<Response> =>
  snapshot.pipe(
    Effect.map((body) =>
      Response.json(body, { headers: { 'Cache-Control': 'no-store' } }),
    ),
    Effect.catch((cause) =>
      Effect.as(
        Effect.logError('the ledger read failed', cause),
        text(503, 'the ledger is unavailable'),
      ),
    ),
  );

/** Answers GET /ledger, the token checked here; `snapshot` reads D1, and `keys` replaces GitHub's JWKS in tests. */
export const respondRead = (
  request: Request,
  env: ReadEnv,
  snapshot: Effect.Effect<LedgerSnapshot, unknown>,
  keys?: JWTVerifyGetKey,
): Effect.Effect<Response> => {
  if (request.method !== 'GET') {
    return Effect.succeed(
      new Response('method not allowed', {
        status: 405,
        headers: { Allow: 'GET' },
      }),
    );
  }

  return authorizeRead(request, env, keys).pipe(
    Effect.andThen(readSnapshot(snapshot)),
    Effect.catchTags({
      InvalidToken: (error) => Effect.succeed(text(401, error.reason)),
      ForbiddenClaim: (error) => Effect.succeed(text(403, error.reason)),
      Misconfigured: (error) =>
        Effect.as(
          Effect.logError(error.reason),
          text(500, 'the ledger is misconfigured'),
        ),
    }),
  );
};

export const readLedger = (
  request: Request,
  env: ReadEnv,
  snapshot: Effect.Effect<LedgerSnapshot, unknown>,
  keys?: JWTVerifyGetKey,
): Promise<Response> =>
  Effect.runPromise(respondRead(request, env, snapshot, keys));
