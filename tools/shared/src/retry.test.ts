import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { withRetry } from './retry.ts';

// Injectable sleep: record backoffs, never wait.
function fakeSleep(record: number[]): (ms: number) => Promise<void> {
  return (ms) => {
    record.push(ms);
    return Promise.resolve();
  };
}

describe('withRetry', () => {
  it('returns the first success without sleeping', async () => {
    const slept: number[] = [];
    const result = await withRetry(() => Promise.resolve('ok'), {
      sleep: fakeSleep(slept),
    });
    assert.equal(result, 'ok');
    assert.deepEqual(slept, []);
  });

  it('retries with exponential backoff and succeeds', async () => {
    const slept: number[] = [];
    let calls = 0;
    const result = await withRetry(
      () => {
        calls += 1;
        return calls < 3
          ? Promise.reject(new Error(`flake ${calls}`))
          : Promise.resolve('ok');
      },
      { attempts: 3, baseDelayMs: 100, sleep: fakeSleep(slept) },
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 3);
    assert.deepEqual(slept, [100, 200]);
  });

  it('throws the last error once attempts are exhausted', async () => {
    const slept: number[] = [];
    let calls = 0;
    await assert.rejects(
      withRetry(
        () => {
          calls += 1;
          return Promise.reject(new Error(`flake ${calls}`));
        },
        { attempts: 3, baseDelayMs: 1, sleep: fakeSleep(slept) },
      ),
      /flake 3/,
    );
    assert.equal(calls, 3);
    assert.deepEqual(slept, [1, 2]);
  });

  it('reports each retry to onRetry with the attempt number', async () => {
    const attempts: number[] = [];
    await assert.rejects(
      withRetry(() => Promise.reject(new Error('nope')), {
        attempts: 2,
        baseDelayMs: 1,
        sleep: () => Promise.resolve(),
        onRetry: (_error, attempt) => attempts.push(attempt),
      }),
    );
    assert.deepEqual(attempts, [1]);
  });
});
