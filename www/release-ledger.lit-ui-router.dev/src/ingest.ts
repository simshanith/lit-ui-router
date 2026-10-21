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
import {
  ForbiddenClaim,
  InvalidToken,
  type OidcPolicy,
  forbiddenReason,
  unverifiedClaims,
  verifyToken,
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

class Misconfigured extends Schema.TaggedError<Misconfigured>()(
  'Misconfigured',
  { reason: Schema.String },
) {}

const text = (status: number, body: string): Response =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

const decodeBody = Schema.decodeUnknownEffect(Schema.fromJsonString(ClaimBody));

const policyOf = (env: IngestEnv): Omit<OidcPolicy, 'audience'> => ({
  repository: env.OIDC_REPOSITORY,
  repositoryId: env.OIDC_REPOSITORY_ID,
  repositoryOwnerId: env.OIDC_REPOSITORY_OWNER_ID,
  workflows: env.OIDC_WORKFLOWS,
  environment: env.OIDC_ENVIRONMENT,
});

function bearerOf(request: Request): string | undefined {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer (\S+)$/.exec(header);

  return match?.[1];
}

const readClaims = (token: string, env: IngestEnv, keys?: JWTVerifyGetKey) =>
  Effect.gen(function* () {
    const audience = env.OIDC_AUDIENCE ?? '';
    const skip = env.LEDGER_DEV_SKIP_OIDC === 'true';

    if (audience === '' && skip) {
      yield* Effect.logWarning('LEDGER_DEV_SKIP_OIDC is set: token unverified');

      return yield* Effect.try({
        try: () => unverifiedClaims(token),
        catch: (cause) =>
          cause instanceof InvalidToken
            ? cause
            : new InvalidToken({ reason: 'unverifiable token' }),
      });
    }

    if (audience === '') {
      return yield* new Misconfigured({ reason: 'OIDC_AUDIENCE is unset' });
    }

    if (skip) {
      yield* Effect.logWarning(
        'LEDGER_DEV_SKIP_OIDC is ignored while OIDC_AUDIENCE is set',
      );
    }

    return yield* Effect.tryPromise({
      try: () => verifyToken(token, audience, keys),
      catch: (cause) =>
        cause instanceof InvalidToken
          ? cause
          : new InvalidToken({ reason: 'unverifiable token' }),
    });
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

    const claims = yield* readClaims(token, env, keys);
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

    yield* Effect.promise(() => env.LEDGER_QUEUE.send(claim));

    return text(202, 'accepted');
  });

/** Answers one request; `keys` replaces GitHub's JWKS in tests. */
export const ingest = (
  request: Request,
  env: IngestEnv,
  keys?: JWTVerifyGetKey,
): Promise<Response> => {
  const { pathname } = new URL(request.url);

  if (pathname !== '/claims') return Promise.resolve(text(404, 'not found'));

  if (request.method !== 'POST') {
    return Promise.resolve(
      new Response('method not allowed', {
        status: 405,
        headers: { Allow: 'POST' },
      }),
    );
  }

  return Effect.runPromise(
    enqueue(request, env, keys).pipe(
      Effect.catchTags({
        InvalidToken: (error) => Effect.succeed(text(401, error.reason)),
        ForbiddenClaim: (error) => Effect.succeed(text(403, error.reason)),
        BadRequest: (error) => Effect.succeed(text(400, error.reason)),
        Misconfigured: (error) =>
          Effect.as(
            Effect.logError(error.reason),
            text(500, 'the ledger is misconfigured'),
          ),
      }),
    ),
  );
};
