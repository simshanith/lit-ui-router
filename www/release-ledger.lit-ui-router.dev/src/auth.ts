// The bearer token and its verified claims, shared by POST /claims and GET /ledger.
import { Effect, Schema } from 'effect';
import type { JWTVerifyGetKey } from 'jose';

import { InvalidToken, unverifiedClaims, verifyToken } from './oidc.ts';

export class Misconfigured extends Schema.TaggedError<Misconfigured>()(
  'Misconfigured',
  { reason: Schema.String },
) {}

export const text = (
  status: number,
  body: string,
  headers?: Record<string, string>,
): Response =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  });

/** A 401 naming the scheme the caller must send (RFC 6750). */
export const unauthorized = (reason: string): Response =>
  text(401, reason, { 'WWW-Authenticate': 'Bearer' });

export function bearerOf(request: Request): string | undefined {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer (\S+)$/.exec(header);

  return match?.[1];
}

/** Where a route's audience comes from; the flag skips verification only while the audience is empty. */
export interface AudienceSource {
  variable: string;
  audience: string | undefined;
  devSkip: string | undefined;
}

export const readClaims = (
  token: string,
  source: AudienceSource,
  keys?: JWTVerifyGetKey,
) =>
  Effect.gen(function* () {
    const audience = source.audience ?? '';
    const skip = source.devSkip === 'true';

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
      return yield* new Misconfigured({
        reason: `${source.variable} is unset`,
      });
    }

    if (skip) {
      yield* Effect.logWarning(
        `LEDGER_DEV_SKIP_OIDC is ignored while ${source.variable} is set`,
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
