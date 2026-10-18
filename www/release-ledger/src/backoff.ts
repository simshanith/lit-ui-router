// Exponential backoff with jitter for every wait the worker takes. A rate
// limit's own wait (Retry-After, GitHub's x-ratelimit-reset) wins over it.

/** Seconds: the first ceiling, and the most any ceiling grows to. */
export interface Backoff {
  readonly base: number;
  readonly cap: number;
}

/** Queue redeliveries; `max_retries` in wrangler.jsonc bounds the total window. */
export const QUEUE_BACKOFF: Backoff = { base: 30, cap: 3600 };

/** Retries inside one fetch, before the message goes back to the queue. */
export const FETCH_BACKOFF: Backoff = { base: 0.5, cap: 4 };

export const FETCH_ATTEMPTS = 3;

/** The longest wait a fetch takes in-request; a longer one becomes the queue's delay. */
export const FETCH_MAX_WAIT_SECONDS = 10;

/** Queues reject a `delaySeconds` above 12 hours. */
export const QUEUE_MAX_DELAY_SECONDS = 43_200;

/** The ceiling for a 1-based attempt: `base` doubled per attempt, up to `cap`. */
export const ceiling = (attempt: number, { base, cap }: Backoff): number =>
  Math.min(cap, base * 2 ** Math.max(0, attempt - 1));

/** Equal jitter: uniform over the upper half of the ceiling, so waits still grow. */
export function backoffSeconds(
  attempt: number,
  backoff: Backoff,
  random: () => number = Math.random,
): number {
  const top = ceiling(attempt, backoff);

  return top / 2 + (random() * top) / 2;
}

/** The redelivery delay for a message on its `attempts`th delivery. */
export function queueDelaySeconds(
  attempts: number,
  retryAfter?: number,
  random?: () => number,
): number {
  const wait = retryAfter ?? backoffSeconds(attempts, QUEUE_BACKOFF, random);

  return Math.min(QUEUE_MAX_DELAY_SECONDS, Math.ceil(wait));
}

/** Retry-After as delta-seconds or an HTTP date. */
function retryAfterHeader(value: string, now: number): number | undefined {
  const seconds = Number(value);

  if (value.trim() !== '' && Number.isFinite(seconds)) {
    return Math.max(0, seconds);
  }

  const at = Date.parse(value);

  return Number.isNaN(at) ? undefined : Math.max(0, (at - now) / 1000);
}

/** A 429, or a 403 carrying GitHub's primary or secondary limit headers, with the seconds it asks to wait. */
export function rateLimit(
  response: Pick<Response, 'status' | 'headers'>,
  now: number,
): { wait: number | undefined } | undefined {
  const { status, headers } = response;
  const retryAfter = headers.get('retry-after');
  const exhausted = headers.get('x-ratelimit-remaining') === '0';

  const limited =
    status === 429 || (status === 403 && (retryAfter !== null || exhausted));

  if (!limited) return undefined;

  if (retryAfter !== null) return { wait: retryAfterHeader(retryAfter, now) };

  const reset = Number(headers.get('x-ratelimit-reset') ?? Number.NaN);

  return {
    wait:
      exhausted && Number.isFinite(reset)
        ? Math.max(0, reset - now / 1000)
        : undefined,
  };
}

/** Worth another fetch: a rate limit, or a server error. */
export const retryable = (status: number): boolean =>
  status === 429 || status >= 500;
