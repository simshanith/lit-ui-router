import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Schema } from 'effect';

import { Claim } from './claim.ts';
import {
  batchesOf,
  call,
  type CloudflareApi,
  manualClaims,
  parseEnqueueArgs,
  publish,
  resolveQueueId,
  selectTags,
} from './enqueue.ts';
import type { ReleaseTag } from './sweep.ts';

const REPOSITORY = 'simshanith/lit-ui-router';

const AT = '2026-10-19T00:00:00.000Z';

const ACCOUNT = 'account-1';

const tagsOf = (count: number): ReleaseTag[] =>
  Array.from({ length: count }, (_, i) => ({
    name: 'pkg',
    version: `1.0.${i}`,
    sha: `sha${i}`,
  }));

describe('parseEnqueueArgs', () => {
  it('takes --all or releases, the actor and --dry-run, past the `--` pnpm forwards', () => {
    assert.deepEqual(parseEnqueueArgs(['--', '--all', '--actor', 'me']), {
      ok: true,
      args: { all: true, releases: [], actor: 'me', dryRun: false },
    });
    assert.deepEqual(
      parseEnqueueArgs(['a@1.0.0', 'b@2.0.0', '--actor=me', '--dry-run']),
      {
        ok: true,
        args: {
          all: false,
          releases: ['a@1.0.0', 'b@2.0.0'],
          actor: 'me',
          dryRun: true,
        },
      },
    );
  });

  const refused: [string, string[], RegExp][] = [
    ['no actor', ['--all'], /--actor is required/],
    ['a blank actor', ['--all', '--actor', ' '], /--actor is required/],
    ['nothing to claim', ['--actor', 'me'], /either --all or/],
    ['--all with releases', ['--all', 'a@1.0.0', '--actor', 'me'], /either/],
    ['an unknown flag', ['--all', '--actor', 'me', '--force'], /--force/],
  ];

  for (const [label, argv, error] of refused) {
    it(`refuses ${label}`, () => {
      const parsed = parseEnqueueArgs(argv);

      assert.ok(!parsed.ok);
      assert.match(parsed.error, error);
    });
  }
});

describe('selectTags', () => {
  const tags = tagsOf(3);

  it('takes every tag for --all and the named ones otherwise, once each', () => {
    assert.deepEqual(selectTags(tags, { all: true, releases: [] }), {
      ok: true,
      tags,
    });
    assert.deepEqual(
      selectTags(tags, { all: false, releases: ['pkg@1.0.2', 'pkg@1.0.2'] }),
      { ok: true, tags: [tags[2]] },
    );
  });

  it('refuses a release with no tag', () => {
    assert.deepEqual(
      selectTags(tags, { all: false, releases: ['pkg@1.0.0', 'pkg@9.0.0'] }),
      { ok: false, error: 'no release tag for pkg@9.0.0' },
    );
  });
});

describe('manualClaims', () => {
  it('claims each tag at its sha under the actor', () => {
    assert.deepEqual(manualClaims(tagsOf(1), REPOSITORY, 'me', AT), [
      {
        receivedAt: AT,
        name: 'pkg',
        version: '1.0.0',
        origin: {
          kind: 'manual',
          repository: REPOSITORY,
          sha: 'sha0',
          actor: 'me',
        },
      },
    ]);
  });
});

describe('batchesOf', () => {
  it('chunks 100 JSON messages a batch, each decoding as the claim', () => {
    const claims = manualClaims(tagsOf(250), REPOSITORY, 'me', AT);
    const batches = batchesOf(claims);

    assert.deepEqual(
      batches.map(({ messages }) => messages.length),
      [100, 100, 50],
    );

    const messages = batches.flatMap((batch) => batch.messages);

    assert.ok(messages.every(({ content_type }) => content_type === 'json'));
    assert.deepEqual(
      messages.map(({ body }) =>
        Schema.decodeUnknownSync(Claim)(JSON.parse(JSON.stringify(body))),
      ),
      claims,
    );
  });
});

const QUEUES = [
  { queue_id: 'q-dlq', queue_name: 'release-ledger-claims-dlq' },
  { queue_id: 'q-claims', queue_name: 'release-ledger-claims' },
];

/** A `result` the API answers: the queue list, or the batch endpoint's metadata. */
type ApiResult = typeof QUEUES | Record<string, never>;

const envelope = (result: ApiResult, init?: ResponseInit) =>
  Response.json({ success: true, errors: null, messages: null, result }, init);

/** An API whose fetch answers in turn and records each request. */
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

describe('resolveQueueId', () => {
  it('finds the queue by name', async () => {
    const { api, requests } = apiAnswering(() => envelope(QUEUES));

    assert.deepEqual(await resolveQueueId(api, 'release-ledger-claims'), {
      ok: true,
      queueId: 'q-claims',
    });
    assert.equal(
      requests[0]?.url,
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/queues`,
    );
    assert.equal(requests[0]?.headers.get('authorization'), 'Bearer secret');
  });

  it('fails for a queue the account lacks', async () => {
    const { api } = apiAnswering(() => envelope([]));

    assert.deepEqual(await resolveQueueId(api, 'release-ledger-claims'), {
      ok: false,
      error: 'no queue named release-ledger-claims in the account',
    });
  });
});

describe('call', () => {
  it("waits out a 429's Retry-After, then exponentially", async () => {
    const limited = () =>
      new Response('{}', { status: 429, headers: { 'Retry-After': '2' } });

    const { api, sleeps } = apiAnswering(
      limited,
      () => new Response('{}', { status: 429 }),
      () => envelope([]),
    );

    assert.deepEqual(await call(api, '/queues', Schema.Array(Schema.String)), {
      ok: true,
      result: [],
    });
    assert.deepEqual(sleeps, [2000, 2000]);
  });

  it("returns the API's errors without the account id or the token", async () => {
    const { api } = apiAnswering(() =>
      Response.json(
        {
          success: false,
          errors: [{ code: 10000, message: 'Authentication error' }],
        },
        { status: 403 },
      ),
    );

    const called = await call(api, '/queues/q/messages/batch', Schema.Unknown, {
      messages: [],
    });

    assert.deepEqual(called, {
      ok: false,
      error:
        'Cloudflare API POST /{account_id}/queues/q/messages/batch failed (HTTP 403) — 10000: Authentication error',
    });
  });

  it('gives up after four 429s', async () => {
    const limited = () => new Response('{}', { status: 429 });
    const { api, requests } = apiAnswering(limited, limited, limited, limited);

    const called = await call(api, '/queues', Schema.Unknown);

    assert.ok(!called.ok);
    assert.match(called.error, /HTTP 429/);
    assert.equal(requests.length, 4);
  });
});

describe('publish', () => {
  it('posts each batch to the queue and logs the count sent', async () => {
    const claims = manualClaims(tagsOf(150), REPOSITORY, 'me', AT);

    const { api, requests } = apiAnswering(
      () => envelope({}),
      () => envelope({}),
    );

    const lines: string[] = [];

    assert.deepEqual(
      await publish(api, 'q-claims', claims, (line) => lines.push(line)),
      {
        ok: true,
      },
    );
    assert.deepEqual(
      requests.map(({ method, url }) => `${method} ${url}`),
      Array.from(
        { length: 2 },
        () =>
          `POST https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/queues/q-claims/messages/batch`,
      ),
    );

    const [first] = requests;
    const body: unknown = await first?.json();

    assert.deepEqual(body, JSON.parse(JSON.stringify(batchesOf(claims)[0])));
    assert.deepEqual(lines, [
      'batch 1/2: sent 100 (100/150)',
      'batch 2/2: sent 50 (150/150)',
    ]);
  });

  it('stops at the first failed batch', async () => {
    const claims = manualClaims(tagsOf(150), REPOSITORY, 'me', AT);

    const { api, requests } = apiAnswering(() =>
      Response.json({ success: false, errors: null }, { status: 500 }),
    );

    const published = await publish(api, 'q-claims', claims, () => {});

    assert.ok(!published.ok);
    assert.match(published.error, /HTTP 500/);
    assert.equal(requests.length, 1);
  });
});
