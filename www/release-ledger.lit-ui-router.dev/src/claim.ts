// The claim's wire shapes: the POST /claims body, the GitHub OIDC claims it is
// verified against, and the queue message the producer hands the consumer.
import { Schema } from 'effect';

/** npm's package name grammar; it also keeps names safe to splice into URLs. */
const PackageName = Schema.String.check(
  Schema.isPattern(/^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/),
);

const Version = Schema.String.check(
  Schema.isPattern(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/),
);

/** Maintainer events stay off /claims until they have their own gated path. */
export const MAINTAINER_ACTIONS = ['repair'] as const;

export const ClaimBody = Schema.Struct({
  name: PackageName,
  version: Version,
  action: Schema.optionalKey(
    Schema.Literals(['observe', ...MAINTAINER_ACTIONS]),
  ),
});

export type ClaimBody = typeof ClaimBody.Type;

/** The GitHub Actions id-token claims the ledger reads; GitHub sends more. */
export const OidcClaims = Schema.Struct({
  repository: Schema.String,
  repository_id: Schema.String,
  repository_owner_id: Schema.String,
  job_workflow_ref: Schema.String,
  run_id: Schema.String,
  run_attempt: Schema.String,
  sha: Schema.String,
  ref: Schema.String,
  event_name: Schema.String,
  environment: Schema.optionalKey(Schema.String),
});

export type OidcClaims = typeof OidcClaims.Type;

/** A claim posted by a GitHub Actions run, with its token's audit fields. */
const RunOrigin = Schema.Struct({
  kind: Schema.Literal('run'),
  repository: Schema.String,
  jobWorkflowRef: Schema.String,
  runId: Schema.String,
  runAttempt: Schema.String,
  sha: Schema.String,
});

/** A claim the worker's Cron Trigger enqueued for a tag it listed. */
const SweepOrigin = Schema.Struct({
  kind: Schema.Literal('sweep'),
  repository: Schema.String,
  cron: Schema.String,
  scheduledAt: Schema.String,
  sha: Schema.String,
});

/** A claim a maintainer published over the Queues HTTP API; /claims never builds one. */
const ManualOrigin = Schema.Struct({
  kind: Schema.Literal('manual'),
  repository: Schema.String,
  sha: Schema.String,
  // self-asserted: the trust anchor is the Cloudflare API token with Queues Edit
  actor: Schema.NonEmptyString,
});

/** The queue message: what to observe, and who asked. */
export const Claim = Schema.Struct({
  receivedAt: Schema.String,
  name: PackageName,
  version: Version,
  origin: Schema.Union([RunOrigin, SweepOrigin, ManualOrigin]),
});

export type Claim = typeof Claim.Type;

/** The `<name>@<version>` a release tag names. */
export const Release = Schema.Struct({ name: PackageName, version: Version });

/** The producer side of the claims queue, as the worker uses it. */
export interface LedgerQueue {
  send(claim: Claim): Promise<void | { readonly metadata: object }>;
  sendBatch(
    messages: Iterable<{ body: Claim }>,
  ): Promise<void | { readonly metadata: object }>;
}
