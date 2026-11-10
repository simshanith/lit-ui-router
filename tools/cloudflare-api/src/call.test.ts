import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getWorkerBuildSettings } from './builds-settings.ts';
import { call, callResult, type CloudflareApi } from './call.ts';

const ACCOUNT = 'account-1';

const SETTINGS = { previews_enabled: false };

const envelope = () =>
  Response.json({
    success: true,
    errors: [],
    messages: [],
    result: SETTINGS,
  });

/** An API whose fetch answers in turn and records each request and sleep. */
function apiAnswering(...answers: (() => Response)[]) {
  const requests: Request[] = [];
  const sleeps: number[] = [];

  const api: CloudflareApi = {
    token: 'secret',
    accountId: ACCOUNT,
    fetch: (input, init) => {
      requests.push(new Request(input, init));

      const answer = answers.shift();

      assert.ok(answer, 'an unexpected request');

      return Promise.resolve(answer());
    },
    sleep: (ms) => {
      sleeps.push(ms);

      return Promise.resolve();
    },
  };

  return { api, requests, sleeps };
}

const getSettings = () =>
  getWorkerBuildSettings({ accountId: ACCOUNT, externalScriptId: 'tag-1' });

describe('callResult', () => {
  it("waits out a 429's Retry-After, then exponentially", async () => {
    const { api, requests, sleeps } = apiAnswering(
      () =>
        new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }),
      () => new Response('{}', { status: 429 }),
      envelope,
    );

    assert.deepEqual(await callResult(api, 'GET settings', getSettings()), {
      ok: true,
      result: { previewsEnabled: false },
    });
    assert.deepEqual(sleeps, [2000, 2000]);
    assert.equal(requests[0]?.headers.get('authorization'), 'Bearer secret');
  });

  it('gives up after four 429s', async () => {
    const limited = () => new Response('{}', { status: 429 });
    const { api, requests } = apiAnswering(limited, limited, limited, limited);

    const called = await callResult(api, 'GET settings', getSettings());

    assert.ok(!called.ok);
    assert.match(called.error, /TooManyRequests/);
    assert.equal(requests.length, 4);
  });

  it("redacts the account id and the token from the SDK's transport errors, cause included", async () => {
    const { api } = apiAnswering(() => {
      throw new TypeError(`fetch failed for ${ACCOUNT} with secret`);
    });

    const called = await callResult(api, 'GET settings', getSettings());

    assert.ok(!called.ok);
    assert.match(called.error, /HttpClientError/);
    assert.match(
      called.error,
      /fetch failed for \{account_id\} with \{token\}/,
    );
  });
});

describe('call', () => {
  it('returns the result', async () => {
    const { api } = apiAnswering(envelope);

    assert.deepEqual(await call(api, 'GET settings', getSettings()), {
      previewsEnabled: false,
    });
  });

  it("throws the API's error without the account id or the token", async () => {
    const { api } = apiAnswering(() =>
      Response.json(
        {
          success: false,
          errors: [
            { code: 10000, message: `no access to ${ACCOUNT} with secret` },
          ],
        },
        { status: 403 },
      ),
    );

    await assert.rejects(
      call(api, 'GET /{account_id}/builds/workers/tag-1', getSettings()),
      {
        message:
          'Cloudflare API GET /{account_id}/builds/workers/tag-1 failed — Unauthorized: no access to {account_id} with {token}',
      },
    );
  });
});
