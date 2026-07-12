// Flaky-op tolerance lives INSIDE the tools — step-level retry actions are
// gone once steps collapse to single `mise run` lines — so remote writes
// (GitHub API via gh) get a short exponential backoff here. release-it
// invocations are deliberately NOT retried: the engine performs multiple
// non-idempotent writes per run, and a blind in-process re-run after a
// partial failure is exactly the rollback trap publish-gh.yml documents;
// a human re-runs the workflow instead.

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  /** Injectable for tests: records the backoff instead of waiting it out. */
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (error: unknown, attempt: number) => void;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Run `fn`, retrying with exponential backoff; throws the last error. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 2000,
    sleep = defaultSleep,
    onRetry,
  } = options;
  if (attempts < 1) throw new Error('attempts must be >= 1');
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      onRetry?.(error, attempt);
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
