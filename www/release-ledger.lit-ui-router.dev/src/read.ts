// GET /ledger: the versions and dist-tags for the release-signals reconcile
// check, behind a read policy that shares nothing with /claims but the pins.
import { Effect, Schema } from 'effect';
import type { JWTVerifyGetKey } from 'jose';

import { bearerOf, readClaims, text } from './ingest.ts';
import type { LedgerSnapshot } from './ledger-sql.ts';
import { ForbiddenClaim, InvalidToken, runForbiddenReason } from './oidc.ts';

export interface ReadEnv {
  OIDC_READ_AUDIENCE?: string;
  OIDC_REPOSITORY: string;
  OIDC_REPOSITORY_ID: string;
  OIDC_REPOSITORY_OWNER_ID: string;
  OIDC_READ_WORKFLOWS: readonly string[];
  LEDGER_DEV_SKIP_OIDC?: string;
}

export const LEDGER_PATH = '/ledger';

class Unavailable extends Schema.TaggedError<Unavailable>()('Unavailable', {
  cause: Schema.Unknown,
}) {}

const respond = (
  request: Request,
  env: ReadEnv,
  snapshot: Effect.Effect<LedgerSnapshot, unknown>,
  keys?: JWTVerifyGetKey,
) =>
  Effect.gen(function* () {
    const token = bearerOf(request);

    if (token === undefined) {
      return yield* new InvalidToken({ reason: 'no bearer token' });
    }

    const claims = yield* readClaims(
      token,
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

    const body = yield* snapshot.pipe(
      Effect.mapError((cause) => new Unavailable({ cause })),
    );

    return Response.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    });
  });

/** Answers GET /ledger; `snapshot` reads D1, and `keys` replaces GitHub's JWKS in tests. */
export const readLedger = (
  request: Request,
  env: ReadEnv,
  snapshot: Effect.Effect<LedgerSnapshot, unknown>,
  keys?: JWTVerifyGetKey,
): Promise<Response> => {
  if (request.method !== 'GET') {
    return Promise.resolve(
      new Response('method not allowed', {
        status: 405,
        headers: { Allow: 'GET' },
      }),
    );
  }

  return Effect.runPromise(
    respond(request, env, snapshot, keys).pipe(
      Effect.catchTags({
        InvalidToken: (error) => Effect.succeed(text(401, error.reason)),
        ForbiddenClaim: (error) => Effect.succeed(text(403, error.reason)),
        Misconfigured: (error) =>
          Effect.as(
            Effect.logError(error.reason),
            text(500, 'the ledger is misconfigured'),
          ),
        Unavailable: (error) =>
          Effect.as(
            Effect.logError('the ledger read failed', error.cause),
            text(503, 'the ledger is unavailable'),
          ),
      }),
    ),
  );
};
