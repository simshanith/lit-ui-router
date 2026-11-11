#!/usr/bin/env node
// Publishes manual claims to the claims queue over Cloudflare's Queues HTTP API,
// so a maintainer can backfill the ledger without waiting for the sweep. The API
// token must never reach stdout or stderr, and errors redact the account id.
//
// Usage: enqueue.ts (--all | <name>@<version>...) --actor <label> [--dry-run]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import {
  bulkPushMessages,
  listQueues,
} from '@distilled.cloud/cloudflare/queues';
import { type CloudflareApi, callResult } from '@tools/cloudflare-api/call.ts';
import { Effect, Schema, Stream } from 'effect';
import { FetchHttpClient } from 'effect/http';
import { parse } from 'jsonc-parser';

import { Claim } from './claim.ts';
import { CLAIMS_QUEUE } from './consume.ts';
import { listTags } from './observe.ts';
import { type ReleaseTag, releaseTags, SEND_BATCH_LIMIT } from './sweep.ts';

const USAGE =
  'usage: enqueue.ts (--all | <name>@<version>...) --actor <label> [--dry-run]';

export interface EnqueueArgs {
  readonly all: boolean;
  readonly releases: readonly string[];
  readonly actor: string;
  readonly dryRun: boolean;
}

export function parseEnqueueArgs(
  argv: readonly string[],
):
  | { readonly ok: true; readonly args: EnqueueArgs }
  | { readonly ok: false; readonly error: string } {
  let parsed;

  try {
    parsed = parseArgs({
      // pnpm forwards the `--` that separates its own flags from the script's
      args: argv[0] === '--' ? argv.slice(1) : [...argv],
      options: {
        all: { type: 'boolean', default: false },
        actor: { type: 'string' },
        'dry-run': { type: 'boolean', default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (error) {
    return { ok: false, error: String(error) };
  }

  const { values, positionals } = parsed;
  const actor = values.actor?.trim() ?? '';

  if (actor === '') return { ok: false, error: '--actor is required' };

  if (values.all ? positionals.length > 0 : positionals.length === 0) {
    return {
      ok: false,
      error: 'pass either --all or <name>@<version> releases',
    };
  }

  return {
    ok: true,
    args: {
      all: values.all,
      releases: positionals,
      actor,
      dryRun: values['dry-run'],
    },
  };
}

/** The listed release tags the args ask for; every named release must be tagged. */
export function selectTags(
  tags: readonly ReleaseTag[],
  { all, releases }: Pick<EnqueueArgs, 'all' | 'releases'>,
):
  | { readonly ok: true; readonly tags: readonly ReleaseTag[] }
  | { readonly ok: false; readonly error: string } {
  if (all) return { ok: true, tags };

  const byTag = new Map(tags.map((tag) => [`${tag.name}@${tag.version}`, tag]));
  const missing = releases.filter((release) => !byTag.has(release));

  if (missing.length > 0) {
    return { ok: false, error: `no release tag for ${missing.join(', ')}` };
  }

  return {
    ok: true,
    tags: [...new Set(releases)].flatMap((release) => byTag.get(release) ?? []),
  };
}

export const manualClaims = (
  tags: readonly ReleaseTag[],
  repository: string,
  actor: string,
  receivedAt: string,
): Claim[] =>
  tags.map(({ name, version, sha }): Claim => ({
    receivedAt,
    name,
    version,
    origin: { kind: 'manual', repository, sha, actor },
  }));

/** One request to the batch endpoint, in the SDK's camelCase. */
export interface QueueBatch {
  readonly messages: {
    readonly body: typeof Claim.Encoded;
    readonly contentType: 'json';
  }[];
}

/** One batch per `SEND_BATCH_LIMIT` claims, encoded so the consumer decodes them. */
export function batchesOf(claims: readonly Claim[]): QueueBatch[] {
  const encode = Schema.encodeSync(Claim);
  const batches: QueueBatch[] = [];

  for (let start = 0; start < claims.length; start += SEND_BATCH_LIMIT) {
    batches.push({
      messages: claims
        .slice(start, start + SEND_BATCH_LIMIT)
        .map((claim) => ({ body: encode(claim), contentType: 'json' })),
    });
  }

  return batches;
}

export async function resolveQueueId(
  api: CloudflareApi,
  name: string,
): Promise<
  | { readonly ok: true; readonly queueId: string }
  | { readonly ok: false; readonly error: string }
> {
  const listed = await callResult(
    api,
    'GET /{account_id}/queues',
    listQueues.items({ accountId: api.accountId }).pipe(Stream.runCollect),
  );

  if (!listed.ok) return listed;

  const queue = listed.result.find((entry) => entry.queueName === name);

  return queue?.queueId
    ? { ok: true, queueId: queue.queueId }
    : { ok: false, error: `no queue named ${name} in the account` };
}

/** Pushes each batch in turn, stopping at the first failure. */
export async function publish(
  api: CloudflareApi,
  queueId: string,
  claims: readonly Claim[],
  log: (line: string) => void,
): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: string }
> {
  const batches = batchesOf(claims);
  let sent = 0;

  for (const [index, batch] of batches.entries()) {
    const pushed = await callResult(
      api,
      `POST /{account_id}/queues/${queueId}/messages/batch`,
      bulkPushMessages({ accountId: api.accountId, queueId, ...batch }),
    );

    if (!pushed.ok) return pushed;

    sent += batch.messages.length;
    log(
      `batch ${index + 1}/${batches.length}: sent ${batch.messages.length} (${sent}/${claims.length})`,
    );
  }

  return { ok: true };
}

const WranglerVars = Schema.Struct({
  vars: Schema.Struct({ OIDC_REPOSITORY: Schema.String }),
});

/** The repository the worker is pinned to, from wrangler.jsonc. */
const deployedRepository = (): string =>
  Schema.decodeUnknownSync(WranglerVars)(
    parse(
      readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
      [],
      { allowTrailingComma: true },
    ),
  ).vars.OIDC_REPOSITORY;

const fail = (error: string): void => {
  console.error(`enqueue: ${error}`);
  process.exitCode = 1;
};

const main = async (argv: readonly string[]): Promise<void> => {
  const parsed = parseEnqueueArgs(argv);

  if (!parsed.ok) {
    console.error(`enqueue: ${parsed.error}\n${USAGE}`);
    process.exitCode = 2;

    return;
  }

  const { args } = parsed;
  const token = process.env.CLOUDFLARE_API_TOKEN ?? '';
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';

  if (!args.dryRun && (token === '' || accountId === '')) {
    fail('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');

    return;
  }

  const repository = deployedRepository();

  const listed = await Effect.runPromise(
    listTags({
      OIDC_REPOSITORY: repository,
      GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    }).pipe(
      Effect.map((refs) => ({ ok: true, refs }) as const),
      Effect.catchTag('ObservationError', (error) =>
        Effect.succeed({
          ok: false,
          error: `${error.source}: ${error.reason}`,
        } as const),
      ),
      Effect.provide(FetchHttpClient.layer),
    ),
  );

  if (!listed.ok) {
    fail(listed.error);

    return;
  }

  const selected = selectTags(releaseTags(listed.refs), args);

  if (!selected.ok) {
    fail(selected.error);

    return;
  }

  const claims = manualClaims(
    selected.tags,
    repository,
    args.actor,
    new Date().toISOString(),
  );

  if (args.dryRun) {
    for (const claim of claims) console.log(JSON.stringify(claim));
    console.log(`dry run: ${claims.length} claims, none sent`);

    return;
  }

  const api: CloudflareApi = { token, accountId, fetch: globalThis.fetch };
  const queue = await resolveQueueId(api, CLAIMS_QUEUE);

  if (!queue.ok) {
    fail(queue.error);

    return;
  }

  const published = await publish(api, queue.queueId, claims, console.log);

  if (!published.ok) fail(published.error);
};

if (import.meta.main) await main(process.argv.slice(2));
