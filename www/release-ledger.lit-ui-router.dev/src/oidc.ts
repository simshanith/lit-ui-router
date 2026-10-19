// Verifies a GitHub Actions OIDC id-token and pins it to the publish workflow.
import { Schema } from 'effect';
import {
  createRemoteJWKSet,
  decodeJwt,
  type JWTPayload,
  type JWTVerifyGetKey,
  jwtVerify,
} from 'jose';

import { type ClaimBody, OidcClaims } from './claim.ts';

export const ISSUER = 'https://token.actions.githubusercontent.com';

// Module scope, so each isolate caches GitHub's keys across requests.
const GITHUB_KEYS = createRemoteJWKSet(new URL(`${ISSUER}/.well-known/jwks`));

export interface OidcPolicy {
  audience: string;
  repository: string;
  repositoryId: string;
  repositoryOwnerId: string;
  /** `job_workflow_ref` paths, without the `@<ref>` suffix. */
  workflows: readonly string[];
  environment: string;
}

/** The token is missing, malformed, or fails signature, issuer or audience. */
export class InvalidToken extends Schema.TaggedError<InvalidToken>()(
  'InvalidToken',
  { reason: Schema.String },
) {}

/** The token is genuine but names a run that may not write the ledger. */
export class ForbiddenClaim extends Schema.TaggedError<ForbiddenClaim>()(
  'ForbiddenClaim',
  { reason: Schema.String },
) {}

const decodeClaims = Schema.decodeUnknownSync(OidcClaims);

function claimsOf(payload: JWTPayload): OidcClaims {
  try {
    return decodeClaims(payload);
  } catch {
    throw new InvalidToken({ reason: 'the token lacks the GitHub run claims' });
  }
}

/** Signature, issuer, audience, `exp` and `iat`; RS256 only. */
export async function verifyToken(
  token: string,
  audience: string,
  keys: JWTVerifyGetKey = GITHUB_KEYS,
): Promise<OidcClaims> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: ISSUER,
      audience,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat'],
      clockTolerance: 60,
    });

    return claimsOf(payload);
  } catch (cause) {
    if (cause instanceof InvalidToken) throw cause;

    throw new InvalidToken({
      reason: cause instanceof Error ? cause.name : 'unverifiable token',
    });
  }
}

/** Local development only: reads the claims without checking the signature. */
export function unverifiedClaims(token: string): OidcClaims {
  try {
    return claimsOf(decodeJwt(token));
  } catch (cause) {
    if (cause instanceof InvalidToken) throw cause;

    throw new InvalidToken({ reason: 'the token is not a JWT' });
  }
}

const workflowPath = (ref: string): string => ref.split('@refs/', 1)[0] ?? '';

/** The reason the run may not claim `body`, or undefined when it may. */
export function forbiddenReason(
  claims: OidcClaims,
  body: ClaimBody,
  policy: Omit<OidcPolicy, 'audience'>,
): string | undefined {
  if (claims.repository !== policy.repository) return 'repository';

  if (claims.repository_id !== policy.repositoryId) return 'repository_id';

  if (claims.repository_owner_id !== policy.repositoryOwnerId) {
    return 'repository_owner_id';
  }

  if (!policy.workflows.includes(workflowPath(claims.job_workflow_ref))) {
    return 'job_workflow_ref';
  }

  if (claims.environment !== policy.environment) return 'environment';

  if (claims.event_name.startsWith('pull_request')) return 'event_name';

  if (
    claims.ref.startsWith('refs/tags/') &&
    claims.ref !== `refs/tags/${body.name}@${body.version}`
  ) {
    return 'ref';
  }

  return undefined;
}
