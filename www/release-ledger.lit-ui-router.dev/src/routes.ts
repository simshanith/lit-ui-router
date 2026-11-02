// Exploration (#1435 x #349): /claims and /ledger as delegating states, wired
// three ways to compare where the OIDC guard runs. Closes unmerged.
import { Effect } from 'effect';
import type { JWTVerifyGetKey } from 'jose';
import { createServerRouter } from 'ui-router-server';
import {
  createFetchHandler,
  type FetchHandler,
  type GuardDenial,
} from 'ui-router-server/fetch';

import type { OidcClaims } from './claim.ts';
import {
  authenticate,
  type IngestEnv,
  publishAudience,
  respond,
  respondVerified,
  text,
} from './ingest.ts';
import type { LedgerSnapshot } from './ledger-sql.ts';
import {
  authorizeRead,
  type ReadEnv,
  readSnapshot,
  respondRead,
} from './read.ts';

export type RoutesEnv = IngestEnv & ReadEnv;

/** What the worker supplies: D1, the tracer, and test keys. */
export interface Wiring<E extends RoutesEnv> {
  snapshot: (env: E) => Effect.Effect<LedgerSnapshot, unknown>;
  run: <A>(name: string, effect: Effect.Effect<A>) => Promise<A>;
  keys?: JWTVerifyGetKey;
  /** Shape of the throw policy probe: answer a delegate's throw in the adapter. */
  onError?: () => Response;
}

// The adapter requires serveShell; no state here is a page, so it never runs.
const noShell = (): never => {
  throw new Error('the ledger serves no shell');
};

/** (a) Each handler checks its own method and token, as the worker does without the router. */
export function guardInHandlers<E extends RoutesEnv>({
  snapshot,
  run,
  keys,
  onError,
}: Wiring<E>): FetchHandler<[E]> {
  const router = createServerRouter({
    mounts: {
      '/': {
        routes: [
          { name: 'claims', url: '/claims', delegate: 'claims' },
          { name: 'ledger', url: '/ledger', delegate: 'ledger' },
        ] as const,
      },
    },
  });

  return createFetchHandler<typeof router, [E]>(router, {
    serveShell: noShell,
    shouldHandle: () => false,
    ...(onError && { onError }),
    delegates: {
      claims: (request, env) =>
        run('ledger.claims', respond(request, env, keys)),
      ledger: (request, env) =>
        run('ledger.read', respondRead(request, env, snapshot(env), keys)),
    },
  });
}

// The guard's verified claims, for the handler it lets through; the adapter has no channel for them.
const verified = new WeakMap<Request, OidcClaims>();

const verifiedClaims = (request: Request): OidcClaims => {
  const claims = verified.get(request);

  if (claims === undefined) throw new Error('no guard verified this request');

  return claims;
};

/**
 * (b) A guard bound by name runs before delegation and answers its own 401/403
 * Response; (c) the same guard returns a denial the adapter turns into one.
 */
export function guardBeforeDelegation<E extends RoutesEnv>(
  { snapshot, run, keys, onError }: Wiring<E>,
  deny: 'response' | 'denial',
): FetchHandler<[E]> {
  const router = createServerRouter({
    mounts: {
      '/': {
        routes: [
          {
            name: 'claims',
            url: '/claims',
            delegate: 'claims',
            methods: ['POST'],
            guard: 'publish',
          },
          {
            name: 'ledger',
            url: '/ledger',
            delegate: 'ledger',
            methods: ['GET'],
            guard: 'read',
          },
        ] as const,
      },
    },
  });

  const denied = (
    status: 401 | 403,
    reason: string,
  ): Response | GuardDenial => {
    if (deny === 'response') return text(status, reason);

    return status === 401
      ? { status, challenge: 'Bearer', reason }
      : { status, reason };
  };

  // A second Effect run beside the handler's: the adapter's await sits between them, so no context or span carries over.
  const settle = (
    name: string,
    request: Request,
    verify: Effect.Effect<
      OidcClaims,
      | { _tag: 'InvalidToken'; reason: string }
      | { _tag: 'ForbiddenClaim'; reason: string }
      | { _tag: 'Misconfigured'; reason: string }
    >,
  ): Promise<Response | GuardDenial | undefined> =>
    run(
      name,
      verify.pipe(
        Effect.map((claims): Response | GuardDenial | undefined => {
          verified.set(request, claims);

          return undefined;
        }),
        Effect.catchTags({
          InvalidToken: (error) => Effect.succeed(denied(401, error.reason)),
          ForbiddenClaim: (error) => Effect.succeed(denied(403, error.reason)),
          // A misconfigured audience is neither 401 nor 403; the guard needs a Response either way.
          Misconfigured: (error) =>
            Effect.as(
              Effect.logError(error.reason),
              text(500, 'the ledger is misconfigured'),
            ),
        }),
      ),
    );

  return createFetchHandler<typeof router, [E]>(router, {
    serveShell: noShell,
    shouldHandle: () => false,
    ...(onError && { onError }),
    guards: {
      // The publish policy reads the body, so this guard only authenticates; the 403s stay in the handler.
      publish: (_context, request, env) =>
        settle(
          'ledger.guard.publish',
          request,
          authenticate(request, publishAudience(env), keys),
        ),
      read: (_context, request, env) =>
        settle('ledger.guard.read', request, authorizeRead(request, env, keys)),
    },
    delegates: {
      claims: (request, env) =>
        run(
          'ledger.claims',
          respondVerified(request, env, verifiedClaims(request)),
        ),
      ledger: (request, env) => {
        verifiedClaims(request);

        return run('ledger.read', readSnapshot(snapshot(env)));
      },
    },
  });
}
