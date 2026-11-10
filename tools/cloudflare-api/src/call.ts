// The token must never reach stdout or stderr, and errors redact the account id.

import {
  type Credentials,
  fromApiToken,
} from '@distilled.cloud/cloudflare/Credentials';
import * as Retry from '@distilled.cloud/cloudflare/Retry';
import { Clock, Duration, Effect, identity, Layer, Redacted } from 'effect';
import { FetchHttpClient, type HttpClient } from 'effect/http';

export interface CloudflareApi {
  readonly token: string;
  readonly accountId: string;
  readonly fetch: typeof globalThis.fetch;
  /** Takes the retry waits in place of the live clock. */
  readonly sleep?: (ms: number) => Promise<void>;
}

/** Attempts per call; only throttling retries, since nothing was accepted. */
const MAX_ATTEMPTS = 4;

// Retry-After wins (capped at 60 s by the SDK); otherwise 1 s, 2 s, 4 s
const ONLY_THROTTLING: Retry.Policy = {
  while: Retry.throttlingOptions.while,
  backoff: {
    baseMs: 1000,
    factor: 2,
    capMs: 8000,
    maxRetries: MAX_ATTEMPTS - 1,
    serverHint: true,
  },
};

/** What a caller reads off an SDK error. */
type SdkError = {
  readonly _tag: string;
  readonly message: string;
  readonly cause?: unknown;
};

// A transport error's own message names only the request; its cause says why.
const causeOf = ({ cause }: SdkError): string =>
  cause instanceof Error ? ` — ${cause.message}` : '';

export type CallResult<T> =
  | { readonly ok: true; readonly result: T }
  | { readonly ok: false; readonly error: string };

/** The live clock, its sleeps handed to `sleep`. */
const sleepingWith = (sleep: (ms: number) => Promise<void>) => {
  const live = Clock.Clock.defaultValue();

  return Effect.provideService(Clock.Clock, {
    currentTimeMillisUnsafe: () => live.currentTimeMillisUnsafe(),
    currentTimeMillis: live.currentTimeMillis,
    currentTimeNanosUnsafe: () => live.currentTimeNanosUnsafe(),
    currentTimeNanos: live.currentTimeNanos,
    monotonicTimeNanosUnsafe: () => live.monotonicTimeNanosUnsafe(),
    monotonicTimeNanos: live.monotonicTimeNanos,
    sleep: (duration) =>
      Effect.promise(() => sleep(Duration.toMillis(duration))),
  });
};

/**
 * One SDK call, retried on throttling only. `shown` names it in errors, which
 * are redacted of the account id and token since check-run summaries are public.
 */
export async function callResult<T, E extends SdkError>(
  api: CloudflareApi,
  shown: string,
  operation: Effect.Effect<T, E, Credentials | HttpClient.HttpClient>,
): Promise<CallResult<T>> {
  const redact = (text: string): string =>
    text
      .replaceAll(api.accountId, '{account_id}')
      .replaceAll(api.token, '{token}');

  return Effect.runPromise(
    operation.pipe(
      Retry.policy(ONLY_THROTTLING),
      Effect.map((result): CallResult<T> => ({ ok: true, result })),
      Effect.catch((error) =>
        Effect.succeed<CallResult<T>>({
          ok: false,
          error: redact(
            `Cloudflare API ${shown} failed — ${error._tag}: ${error.message}${causeOf(error)}`,
          ),
        }),
      ),
      Effect.provide(
        Layer.mergeAll(
          fromApiToken({ apiToken: Redacted.make(api.token) }),
          FetchHttpClient.layer,
        ),
      ),
      Effect.provideService(FetchHttpClient.Fetch, api.fetch),
      api.sleep === undefined ? identity : sleepingWith(api.sleep),
    ),
  );
}

/** {@link callResult}, throwing its redacted error. */
export async function call<T, E extends SdkError>(
  api: CloudflareApi,
  shown: string,
  operation: Effect.Effect<T, E, Credentials | HttpClient.HttpClient>,
): Promise<T> {
  const called = await callResult(api, shown, operation);

  if (!called.ok) throw new Error(called.error);

  return called.result;
}
