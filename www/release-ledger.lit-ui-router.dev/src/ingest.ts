// POST /claims: verify the caller's GitHub OIDC token, decode the body, and
// enqueue the claim. Nothing here writes to D1; the queue consumer does.
import { Effect, Schema } from 'effect';
import type { JWTVerifyGetKey } from 'jose';

import {
  type Claim,
  ClaimBody,
  type LedgerQueue,
  MAINTAINER_ACTIONS,
} from './claim.ts';
import { bearerOf, readClaims, text, unauthorized } from './auth.ts';
import {
  ForbiddenClaim,
  InvalidToken,
  type OidcPolicy,
  forbiddenReason,
} from './oidc.ts';

export interface IngestEnv {
  OIDC_AUDIENCE?: string;
  OIDC_REPOSITORY: string;
  OIDC_REPOSITORY_ID: string;
  OIDC_REPOSITORY_OWNER_ID: string;
  OIDC_WORKFLOWS: readonly string[];
  OIDC_ENVIRONMENT: string;
  /** Skips the token's signature, issuer and audience checks, only while OIDC_AUDIENCE is empty. */
  LEDGER_DEV_SKIP_OIDC?: string;
  LEDGER_QUEUE: Pick<LedgerQueue, 'send'>;
}

class BadRequest extends Schema.TaggedError<BadRequest>()('BadRequest', {
  reason: Schema.String,
}) {}

const decodeBody = Schema.decodeUnknownEffect(Schema.fromJsonString(ClaimBody));

const policyOf = (env: IngestEnv): Omit<OidcPolicy, 'audience'> => ({
  repository: env.OIDC_REPOSITORY,
  repositoryId: env.OIDC_REPOSITORY_ID,
  repositoryOwnerId: env.OIDC_REPOSITORY_OWNER_ID,
  workflows: env.OIDC_WORKFLOWS,
  environment: env.OIDC_ENVIRONMENT,
});

const readBody = (request: Request) =>
  Effect.gen(function* () {
    const body = yield* Effect.tryPromise({
      try: () => request.text(),
      catch: () => new BadRequest({ reason: 'the body is unreadable' }),
    });

    return yield* decodeBody(body).pipe(
      Effect.mapError((error) => new BadRequest({ reason: error.message })),
    );
  });

const enqueue = (request: Request, env: IngestEnv, keys?: JWTVerifyGetKey) =>
  Effect.gen(function* () {
    const token = bearerOf(request);

    if (token === undefined) {
      return yield* new InvalidToken({ reason: 'no bearer token' });
    }

    const claims = yield* readClaims(
      token,
      {
        variable: 'OIDC_AUDIENCE',
        audience: env.OIDC_AUDIENCE,
        devSkip: env.LEDGER_DEV_SKIP_OIDC,
      },
      keys,
    ).pipe(Effect.withSpan('ledger.verify-token'));

    const body = yield* readBody(request);

    if (body.action !== undefined && body.action !== 'observe') {
      return yield* new ForbiddenClaim({
        reason: `${MAINTAINER_ACTIONS.join(' and ')} are not accepted over /claims`,
      });
    }

    const forbidden = forbiddenReason(claims, body, policyOf(env));

    if (forbidden !== undefined) {
      return yield* new ForbiddenClaim({
        reason: `${forbidden} is not allowed`,
      });
    }

    const claim: Claim = {
      receivedAt: new Date().toISOString(),
      name: body.name,
      version: body.version,
      origin: {
        kind: 'run',
        repository: claims.repository,
        jobWorkflowRef: claims.job_workflow_ref,
        runId: claims.run_id,
        runAttempt: claims.run_attempt,
        sha: claims.sha,
      },
    };

    yield* Effect.annotateCurrentSpan({
      'ledger.package': claim.name,
      'ledger.version': claim.version,
    });
    yield* Effect.promise(() => env.LEDGER_QUEUE.send(claim));

    return text(202, 'accepted');
  });

/** Answers one request; `keys` replaces GitHub's JWKS in tests. */
export const respond = (
  request: Request,
  env: IngestEnv,
  keys?: JWTVerifyGetKey,
): Effect.Effect<Response> => {
  const { pathname } = new URL(request.url);

  if (pathname !== '/claims') return Effect.succeed(text(404, 'not found'));

  if (request.method !== 'POST') {
    return Effect.succeed(
      new Response('method not allowed', {
        status: 405,
        headers: { Allow: 'POST' },
      }),
    );
  }

  return enqueue(request, env, keys).pipe(
    Effect.catchTags({
      InvalidToken: (error) => Effect.succeed(unauthorized(error.reason)),
      ForbiddenClaim: (error) => Effect.succeed(text(403, error.reason)),
      BadRequest: (error) => Effect.succeed(text(400, error.reason)),
      Misconfigured: (error) =>
        Effect.as(
          Effect.logError(error.reason),
          text(500, 'the ledger is misconfigured'),
        ),
    }),
  );
};

export const ingest = (
  request: Request,
  env: IngestEnv,
  keys?: JWTVerifyGetKey,
): Promise<Response> => Effect.runPromise(respond(request, env, keys));
