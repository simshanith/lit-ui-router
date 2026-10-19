import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Effect } from 'effect';
import { FetchHttpClient } from 'effect/http';

import type { Claim } from './claim.ts';
import { sweep, sweepClaims } from './sweep.ts';

const REPOSITORY = 'simshanith/lit-ui-router';

const RUN = { cron: '0 6 * * *', scheduledAt: '2026-10-17T06:00:00.000Z' };

const ref = (tag: string, sha = 'abc') => ({
  ref: `refs/tags/${tag}`,
  object: { sha },
});

describe('sweepClaims', () => {
  it('claims every release tag and skips the rest', () => {
    const claims = sweepClaims(
      [
        ref('lit-ui-router@1.16.5', 's1'),
        ref('@scope/pkg@1.0.0-rc.1', 's2'),
        ref('v1.0.0'),
        ref('lit-ui-router@latest'),
        ref('@1.0.0'),
      ],
      REPOSITORY,
      RUN,
    );

    assert.deepEqual(claims, [
      {
        receivedAt: RUN.scheduledAt,
        name: 'lit-ui-router',
        version: '1.16.5',
        origin: { kind: 'sweep', repository: REPOSITORY, ...RUN, sha: 's1' },
      },
      {
        receivedAt: RUN.scheduledAt,
        name: '@scope/pkg',
        version: '1.0.0-rc.1',
        origin: { kind: 'sweep', repository: REPOSITORY, ...RUN, sha: 's2' },
      },
    ]);
  });
});

describe('sweep', () => {
  it('lists tags with the token and enqueues them 100 at a time', async () => {
    const refs = Array.from({ length: 150 }, (_, i) => ref(`pkg@1.0.${i}`));
    const fetched: Request[] = [];

    const fetch: typeof globalThis.fetch = (input, init) => {
      fetched.push(new Request(input, init));

      return Promise.resolve(Response.json(refs));
    };

    const batches: Claim[][] = [];

    await Effect.runPromise(
      sweep(
        {
          OIDC_REPOSITORY: REPOSITORY,
          GITHUB_TOKEN: 'read-only',
          LEDGER_QUEUE: {
            sendBatch: (messages) => {
              batches.push([...messages].map(({ body }) => body));

              return Promise.resolve();
            },
          },
        },
        RUN,
      ).pipe(
        Effect.provide(FetchHttpClient.layer),
        Effect.provideService(FetchHttpClient.Fetch, fetch),
      ),
    );

    assert.equal(
      fetched[0]?.url,
      `https://api.github.com/repos/${REPOSITORY}/git/matching-refs/tags/`,
    );
    assert.equal(fetched[0]?.headers.get('Authorization'), 'Bearer read-only');
    assert.deepEqual(
      batches.map((batch) => batch.length),
      [100, 50],
    );
  });
});
