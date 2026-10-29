// The worker in workerd through wrangler's test harness: /claims on the real
// bundle, and the consumer folding into the harness's local D1 with the
// observations stubbed. The harness runs no consumer, so nothing reaches npm.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';

import { D1Client } from '@effect/sql-d1';
import type { D1ClientConfig } from '@effect/sql-d1/D1Client';
import { FACT_COLUMNS, type VersionRow } from '@tools/release-ledger';
import { GH, NPM, ROWS, SHA } from '@tools/release-ledger/fixtures';
import { Effect, Layer, Option, Schema } from 'effect';
import { FetchHttpClient } from 'effect/http';
import type { SqlClient } from 'effect/sql';
import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import { createTestHarness } from 'wrangler';

import type { Claim } from './claim.ts';
import {
  CLAIMS_QUEUE,
  consume,
  DEAD_LETTER_QUEUE,
  type LedgerBatch,
  type LedgerMessage,
  QUEUE_BACKOFF,
  queueCeiling,
} from './consume.ts';
import { findPackages, findTagged, findVersions } from './ledger-sql.ts';
import {
  ObservationError,
  Observer,
  ObserverLive,
  type Sources,
} from './observe.ts';

const ROOT = join(import.meta.dirname, '..');

// wrangler writes its bundles under <root>/.wrangler; keep them out of the tree turbo hashes.
const SCRATCH = mkdtempSync(join(tmpdir(), 'release-ledger-'));

const WranglerConfig = Schema.Struct({
  compatibility_date: Schema.String,
  vars: Schema.Record(
    Schema.String,
    Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  ),
  d1_databases: Schema.Tuple([
    Schema.Struct({
      binding: Schema.String,
      database_name: Schema.String,
      database_id: Schema.String,
      migrations_dir: Schema.String,
    }),
  ]),
  queues: Schema.Struct({
    producers: Schema.Tuple([
      Schema.Struct({ binding: Schema.String, queue: Schema.String }),
    ]),
    consumers: Schema.Array(
      Schema.Struct({
        queue: Schema.String,
        max_batch_size: Schema.Number,
        max_concurrency: Schema.Number,
        max_retries: Schema.Number,
        dead_letter_queue: Schema.optionalKey(Schema.String),
      }),
    ),
  }),
});

function readConfig() {
  const errors: ParseError[] = [];

  const config: unknown = parse(
    readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8'),
    errors,
    { allowTrailingComma: true },
  );

  if (errors.length > 0) {
    throw new Error(
      `wrangler.jsonc: ${errors.map((e) => printParseErrorCode(e.error)).join(', ')}`,
    );
  }

  return Schema.decodeUnknownSync(WranglerConfig)(config);
}

const config = readConfig();

const [database] = config.d1_databases;

// The deployed config minus its consumers, with test vars.
const harnessConfig = (vars: typeof config.vars) => ({
  name: 'release-ledger',
  main: join(ROOT, 'worker/index.ts'),
  compatibility_date: config.compatibility_date,
  vars,
  d1_databases: [
    { ...database, migrations_dir: join(ROOT, database.migrations_dir) },
  ],
  queues: { producers: [...config.queues.producers] },
});

const DEPLOYED_VARS = config.vars;

const { OIDC_AUDIENCE: _audience, ...VARS_WITHOUT_AUDIENCE } = DEPLOYED_VARS;

const server = createTestHarness({
  root: SCRATCH,
  workers: [{ config: harnessConfig(DEPLOYED_VARS) }],
});

type DB = D1ClientConfig['db'];

let db: DB;

before(() => server.listen());

after(async () => {
  await server.close();
  rmSync(SCRATCH, { recursive: true, force: true });
});

const CLAIMS_TOKEN = [
  { alg: 'none' },
  {
    repository: 'simshanith/lit-ui-router',
    repository_id: '1025140115',
    repository_owner_id: '135388',
    job_workflow_ref:
      'simshanith/lit-ui-router/.github/workflows/publish-npm.yml@refs/tags/lit-ui-router@1.0.0',
    run_id: '100',
    run_attempt: '1',
    sha: SHA,
    ref: 'refs/tags/lit-ui-router@1.0.0',
    event_name: 'push',
    environment: 'publish',
  },
]
  .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
  .join('.')
  .concat('.');

const postClaim = (body: string, token = CLAIMS_TOKEN) =>
  server.fetch('/claims', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });

describe('wrangler.jsonc', () => {
  // one consumer at a time keeps the read-to-batch window free of other writers
  it('consumes the claims queue one message at a time into the dead-letter queue', () => {
    const [claims, dead] = config.queues.consumers;

    assert.equal(config.queues.producers[0].queue, CLAIMS_QUEUE);
    assert.equal(claims?.queue, CLAIMS_QUEUE);
    assert.equal(claims?.max_batch_size, 1);
    assert.equal(claims?.max_concurrency, 1);
    assert.equal(claims?.dead_letter_queue, DEAD_LETTER_QUEUE);
    assert.equal(dead?.queue, DEAD_LETTER_QUEUE);
  });

  it('deploys no LEDGER_DEV_SKIP_OIDC', () => {
    assert.ok(!('LEDGER_DEV_SKIP_OIDC' in config.vars));
    assert.notEqual(config.vars.OIDC_AUDIENCE ?? '', '');
  });

  it('gives up on a claim before the next daily sweep', () => {
    const [claims] = config.queues.consumers;
    let window = 0;

    for (let attempt = 1; attempt <= (claims?.max_retries ?? 0); attempt += 1) {
      window += queueCeiling(attempt);
    }

    assert.ok(window > 3600, `${window}s outlasts a GitHub rate-limit reset`);
    assert.ok(window < 24 * 3600, `${window}s ends before the next sweep`);
  });
});

describe('the claims state in workerd', { timeout: 120_000 }, () => {
  it('delegates a JSON POST /claims to ingest', async () => {
    const response = await server.fetch('/claims', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: '{}',
    });

    assert.equal(response.status, 401);
    assert.equal(await response.text(), 'no bearer token');
  });

  it('answers 405 with Allow: POST for GET /claims', async () => {
    const response = await server.fetch('/claims', {
      headers: { Accept: 'text/html' },
    });

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
  });

  it('answers a plain-text 404 off /claims', async () => {
    for (const [path, init] of [
      ['/', { headers: { Accept: 'text/html' } }],
      ['/claims/1', { method: 'POST', body: '{}' }],
      ['/other', { method: 'POST', body: '{}' }],
    ] as const) {
      const response = await server.fetch(path, init);

      assert.equal(response.status, 404, path);
      assert.equal(await response.text(), 'not found', path);
    }
  });
});

describe('POST /claims in workerd', { timeout: 120_000 }, () => {
  it('answers 401 for an unverifiable token under the deployed audience', async () => {
    const response = await postClaim(
      JSON.stringify({ name: 'lit-ui-router', version: '1.0.0' }),
    );

    assert.equal(response.status, 401);
  });

  it('ignores LEDGER_DEV_SKIP_OIDC under the deployed audience', async () => {
    await server.update({
      root: SCRATCH,
      workers: [
        {
          config: harnessConfig({
            ...DEPLOYED_VARS,
            LEDGER_DEV_SKIP_OIDC: 'true',
          }),
        },
      ],
    });

    const response = await postClaim(
      JSON.stringify({ name: 'lit-ui-router', version: '1.0.0' }),
    );

    assert.equal(response.status, 401);
  });

  it('answers 500 when the audience is unset and no dev flag is', async () => {
    await server.update({
      root: SCRATCH,
      workers: [{ config: harnessConfig(VARS_WITHOUT_AUDIENCE) }],
    });

    assert.equal((await postClaim('{}')).status, 500);
  });

  it('answers 400 and 202 under the .dev.vars that blank the audience', async () => {
    await server.update({
      root: SCRATCH,
      workers: [
        {
          config: harnessConfig({
            ...DEPLOYED_VARS,
            OIDC_AUDIENCE: '',
            LEDGER_DEV_SKIP_OIDC: 'true',
          }),
        },
      ],
    });

    assert.equal((await postClaim('not json')).status, 400);
    assert.equal(
      (
        await postClaim(
          JSON.stringify({ name: 'lit-ui-router', version: '1.0.0' }),
        )
      ).status,
      202,
    );
  });
});

const NAME = ROWS.tagged.name;

const VERSION = ROWS.tagged.version;

const claimOf = (receivedAt = new Date().toISOString()): Claim => ({
  receivedAt,
  name: NAME,
  version: VERSION,
  origin: {
    kind: 'run',
    repository: 'simshanith/lit-ui-router',
    jobWorkflowRef:
      'simshanith/lit-ui-router/.github/workflows/publish-npm.yml@refs/tags/lit-ui-router@1.0.0',
    runId: '100',
    runAttempt: '1',
    sha: SHA,
  },
});

interface Recorded extends LedgerMessage {
  acks: number;
  retries: ({ delaySeconds?: number } | undefined)[];
}

let ids = 0;

function messageOf(body: Claim | Partial<Claim>, id = `m${++ids}`): Recorded {
  const message: Recorded = {
    id,
    timestamp: new Date('2026-10-17T00:00:00.000Z'),
    attempts: 1,
    body,
    acks: 0,
    retries: [],
    ack: () => {
      message.acks += 1;
    },
    retry: (options) => {
      message.retries.push(options);
    },
  };

  return message;
}

/** Not acked, and sent back once with the first backoff delay. */
function retriedOnce(message: Recorded): void {
  const [retry, ...rest] = message.retries;
  const delay = retry?.delaySeconds ?? 0;

  assert.deepEqual([message.acks, rest], [0, []]);
  assert.ok(
    delay >= QUEUE_BACKOFF.base / 2 && delay <= QUEUE_BACKOFF.base,
    `${delay}s`,
  );
}

const RELEASED: Sources = {
  tag: { sha: SHA },
  npm: { integrity: NPM.integrity, publishedAt: NPM.publishedAt },
  gh: GH,
  distTags: { latest: VERSION },
};

const observing = (
  observe: (
    name: string,
    version: string,
  ) => Effect.Effect<Sources, ObservationError>,
) => Layer.succeed(Observer, { observe });

const sees = (sources: Sources) => observing(() => Effect.succeed(sources));

const run = <A, E>(
  effect: Effect.Effect<
    A,
    E,
    D1Client.D1Client | SqlClient.SqlClient | Observer
  >,
  observer = sees(RELEASED),
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(Layer.mergeAll(D1Client.layer({ db }), observer)),
    ),
  );

const deliver = (
  messages: Recorded[],
  observer?: Layer.Layer<Observer>,
  queue = CLAIMS_QUEUE,
) => run(consume({ queue, messages } satisfies LedgerBatch), observer);

const all = async (table: string) =>
  (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results;

const VERSION_COLUMNS = [
  'name',
  'version',
  'first_seen_at',
  ...FACT_COLUMNS,
] as const;

const statuses = async () =>
  (await run(findVersions({ name: NAME }))).map(({ status }) => status);

const ledgerEvents = async () =>
  (await all('ledger_events')).map(
    ({ region, event }) => `${String(region)} ${String(event)}`,
  );

const seed = (row: VersionRow) =>
  db
    .prepare(
      `INSERT INTO versions (${VERSION_COLUMNS.join(', ')}) VALUES (${VERSION_COLUMNS.map(() => '?').join(', ')})`,
    )
    .bind(...VERSION_COLUMNS.map((column) => row[column]))
    .run();

describe('queue consumer', { timeout: 120_000 }, () => {
  // server.update() poisons earlier binding stubs, so take them here.
  before(async () => {
    const worker = server.getWorker<{ DB: DB }>();
    await worker.applyD1Migrations('DB');
    ({ DB: db } = await worker.getEnv());
  });

  beforeEach(async () => {
    await db.batch(
      [
        'DROP TRIGGER IF EXISTS fail_ledger_events',
        'DELETE FROM ledger_events',
        'DELETE FROM dist_tags',
        'DELETE FROM versions',
        'DELETE FROM claims',
      ].map((statement) => db.prepare(statement)),
    );
  });

  it('folds a release into one row, its dist-tag and its ledger events', async () => {
    const message = messageOf(claimOf());

    await deliver([message]);

    assert.deepEqual([message.acks, message.retries], [1, []]);

    const [row] = await run(findVersions({ name: NAME }));
    assert.equal(row?.status, 'released');
    assert.equal(row?.npm_state, 'active');
    assert.equal(row?.gh_state, 'final');
    assert.equal(row?.gh_release_id, GH.id);

    assert.deepEqual(await ledgerEvents(), [
      'tag observed',
      'npm observed',
      'gh observed',
      'npm dist_tag_moved',
    ]);
    assert.deepEqual(
      (await all('dist_tags')).map(({ tag, version }) => ({ tag, version })),
      [{ tag: 'latest', version: VERSION }],
    );

    const [claim] = await all('claims');
    assert.equal(claim?.message_id, message.id);
    assert.equal(claim?.origin, 'run');
    assert.equal(claim?.run_id, '100');
    assert.equal(claim?.outcome, 'applied');
    assert.deepEqual(
      (await db.prepare('SELECT DISTINCT claim_id FROM ledger_events').all())
        .results,
      [{ claim_id: claim?.id }],
    );

    const tagged = await run(findTagged({ name: NAME, tag: 'latest' }));
    assert.equal(Option.getOrThrow(tagged).version, VERSION);
  });

  it('stores a redelivered message once', async () => {
    const message = messageOf(claimOf());

    await deliver([message]);
    await deliver([message]);

    assert.equal(message.acks, 2);
    assert.equal((await all('claims')).length, 1);
    assert.equal((await all('ledger_events')).length, 4);
  });

  it('records a rejected claim and writes nothing', async () => {
    const message = messageOf(claimOf());

    await deliver(
      [message],
      sees({ ...RELEASED, npm: { ...RELEASED.npm!, deprecated: '' } }),
    );

    assert.equal(message.acks, 1);
    assert.deepEqual(await all('versions'), []);
    assert.deepEqual(await all('dist_tags'), []);

    const [claim] = await all('claims');

    assert.equal(claim?.outcome, 'rejected');
    assert.match(String(claim?.reason), /empty deprecation message/);
  });

  it('records npm and GitHub for a version whose tag is gone', async () => {
    const message = messageOf(claimOf());

    await deliver([message], sees({ ...RELEASED, tag: null, distTags: {} }));

    assert.equal(message.acks, 1);
    assert.deepEqual(await statuses(), ['untagged']);
    assert.equal((await all('versions'))[0]?.git_sha, null);
    assert.deepEqual(await ledgerEvents(), ['npm observed', 'gh observed']);
  });

  it('removes a dist-tag npm no longer carries', async () => {
    await seed(ROWS.released);
    await db
      .prepare(
        "INSERT INTO dist_tags (name, tag, version, updated_at) VALUES (?, 'next', ?, 'then')",
      )
      .bind(NAME, VERSION)
      .run();
    const message = messageOf(claimOf());

    await deliver([message], sees({ ...RELEASED, distTags: {} }));

    assert.equal(message.acks, 1);
    assert.deepEqual(await all('dist_tags'), []);
    assert.deepEqual(await ledgerEvents(), ['npm dist_tag_removed']);
  });

  it('keeps the recorded dist-tags when npm answers 404 for them', async () => {
    await seed(ROWS.released);
    await db
      .prepare(
        "INSERT INTO dist_tags (name, tag, version, updated_at) VALUES (?, 'next', ?, 'then')",
      )
      .bind(NAME, VERSION)
      .run();
    const message = messageOf(claimOf());

    const answers: [RegExp, unknown][] = [
      [/\/dist-tags$/, null],
      [/\/git\/ref\//, { object: { sha: SHA, type: 'commit', url: '' } }],
      [
        /\/releases\/tags\//,
        {
          id: GH.id,
          html_url: GH.url,
          prerelease: GH.prerelease,
          body: GH.body,
          published_at: GH.publishedAt,
        },
      ],
      [/\/[^/]+\/\d+\.\d+\.\d+$/, { dist: { integrity: NPM.integrity } }],
      [
        /registry\.npmjs\.org\/[^/]+$/,
        { time: { [VERSION]: NPM.publishedAt } },
      ],
    ];

    const fetch: typeof globalThis.fetch = (input) => {
      const url = input instanceof Request ? input.url : String(input);
      const answer = answers.find(([pattern]) => pattern.test(url));

      assert.ok(answer, url);

      return Promise.resolve(
        answer[1] === null
          ? new Response('{}', { status: 404 })
          : Response.json(answer[1]),
      );
    };

    const npm = ObserverLive({
      OIDC_REPOSITORY: 'simshanith/lit-ui-router',
    }).pipe(
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)),
    );

    await deliver([message], npm);

    assert.deepEqual([message.acks, message.retries], [1, []]);
    assert.deepEqual(
      (await all('dist_tags')).map(({ tag, version }) => ({ tag, version })),
      [{ tag: 'next', version: VERSION }],
    );
    assert.deepEqual(await ledgerEvents(), []);
  });

  it('records a contradicted npm fact as a conflict and keeps the recorded one', async () => {
    await seed(ROWS.released);
    const message = messageOf(claimOf());

    await deliver(
      [message],
      sees({
        ...RELEASED,
        npm: { ...RELEASED.npm!, integrity: 'sha512-BBBB' },
      }),
    );

    assert.equal(message.acks, 1);

    const [row] = await all('versions');

    assert.equal(row?.npm_integrity, NPM.integrity);
    assert.deepEqual(JSON.parse(String(row?.npm_conflict)), {
      npm_integrity: 'sha512-BBBB',
      npm_published_at: NPM.publishedAt,
    });
    assert.deepEqual(await statuses(), ['conflict']);
    // npm's pointer still moves onto the row
    assert.deepEqual(await ledgerEvents(), [
      'npm observed',
      'npm dist_tag_moved',
    ]);
    assert.equal((await all('claims'))[0]?.outcome, 'applied');
  });

  it('records a conflict when npm reports a recorded version absent', async () => {
    await seed(ROWS.released);
    const message = messageOf(claimOf('2026-10-01T00:00:00.000Z'));

    await deliver([message], sees({ ...RELEASED, npm: null, distTags: {} }));

    assert.equal(message.acks, 1);

    const [row] = await all('versions');

    assert.equal(row?.npm_integrity, NPM.integrity);
    assert.equal(row?.npm_conflict, 'null');
    assert.equal(row?.gh_conflict, null);
  });

  it('retries when an observation fails', async () => {
    const message = messageOf(claimOf());

    const down = observing(() =>
      Effect.fail(
        new ObservationError({ source: 'npm version', reason: 'HTTP 503' }),
      ),
    );

    await deliver([message], down);

    retriedOnce(message);
    assert.deepEqual(await all('claims'), []);
  });

  it('retries after the wait a rate limit asked for', async () => {
    const message = messageOf(claimOf());

    const limited = observing(() =>
      Effect.fail(
        new ObservationError({
          source: 'github release',
          reason: 'HTTP 429',
          retryAfter: 600.5,
        }),
      ),
    );

    await deliver([message], limited);

    assert.deepEqual(
      [message.acks, message.retries],
      [0, [{ delaySeconds: 601 }]],
    );
  });

  it('folds a GitHub release that is ahead of npm', async () => {
    const message = messageOf(claimOf());
    await deliver([message], sees({ ...RELEASED, npm: null, distTags: {} }));

    assert.equal(message.acks, 1);
    assert.deepEqual(await statuses(), ['tagged']);
    assert.equal((await all('versions'))[0]?.gh_release_id, GH.id);
  });

  it('leaves no partial rows when a statement in the batch fails', async () => {
    await db
      .prepare(
        "CREATE TRIGGER fail_ledger_events BEFORE INSERT ON ledger_events BEGIN SELECT RAISE(ABORT, 'boom'); END",
      )
      .run();
    const message = messageOf(claimOf());

    await deliver([message]);

    retriedOnce(message);

    for (const table of ['versions', 'dist_tags', 'ledger_events', 'claims']) {
      assert.deepEqual(await all(table), [], table);
    }
  });

  it('records a sweep claim with no run columns', async () => {
    const sweepClaim: Claim = {
      ...claimOf(),
      origin: {
        kind: 'sweep',
        repository: 'simshanith/lit-ui-router',
        cron: '0 6 * * *',
        scheduledAt: '2026-10-17T06:00:00.000Z',
        sha: SHA,
      },
    };

    const message = messageOf(sweepClaim);

    await deliver([message]);

    const [claim] = await all('claims');

    assert.deepEqual(
      [
        claim?.origin,
        claim?.job_workflow_ref,
        claim?.run_id,
        claim?.run_attempt,
      ],
      ['sweep', null, null, null],
    );
    assert.equal(claim?.body, JSON.stringify(sweepClaim));
  });

  it('folds a manual claim to applied, recording its actor and no run columns', async () => {
    const manualClaim: Claim = {
      ...claimOf(),
      origin: {
        kind: 'manual',
        repository: 'simshanith/lit-ui-router',
        sha: SHA,
        actor: 'simshanith',
      },
    };

    const message = messageOf(manualClaim);

    await deliver([message]);

    assert.deepEqual([message.acks, message.retries], [1, []]);
    assert.deepEqual(await statuses(), ['released']);

    const [claim] = await all('claims');

    assert.deepEqual(
      {
        outcome: claim?.outcome,
        origin: claim?.origin,
        repository: claim?.repository,
        sha: claim?.sha,
        actor: claim?.actor,
        job_workflow_ref: claim?.job_workflow_ref,
        run_id: claim?.run_id,
        run_attempt: claim?.run_attempt,
      },
      {
        outcome: 'applied',
        origin: 'manual',
        repository: 'simshanith/lit-ui-router',
        sha: SHA,
        actor: 'simshanith',
        job_workflow_ref: null,
        run_id: null,
        run_attempt: null,
      },
    );
    assert.equal(claim?.body, JSON.stringify(manualClaim));
  });

  const UNDECODABLE = {
    name: null,
    version: null,
    origin: null,
    repository: null,
    job_workflow_ref: null,
    run_id: null,
    run_attempt: null,
    sha: null,
    actor: null,
  };

  it('records a message that is not a claim as undecodable without retrying it', async () => {
    const message = messageOf({ name: NAME });

    await deliver([message]);
    await deliver([message]);

    assert.deepEqual([message.acks, message.retries], [2, []]);
    assert.deepEqual(await all('claims'), [
      {
        id: 1,
        message_id: message.id,
        received_at: '2026-10-17T00:00:00.000Z',
        body: JSON.stringify({ name: NAME }),
        outcome: 'undecodable',
        reason: null,
        attempts: 1,
        ...UNDECODABLE,
      },
    ]);
  });

  it('records a dead-lettered claim as exhausted, once', async () => {
    const claim = claimOf();
    const message = messageOf(claim);

    await deliver([message], undefined, DEAD_LETTER_QUEUE);
    await deliver([message], undefined, DEAD_LETTER_QUEUE);

    assert.equal(message.acks, 2);
    assert.deepEqual(await all('claims'), [
      {
        id: 1,
        message_id: message.id,
        received_at: claim.receivedAt,
        body: JSON.stringify(claim),
        outcome: 'exhausted',
        reason: null,
        attempts: 1,
        name: NAME,
        version: VERSION,
        origin: 'run',
        repository: 'simshanith/lit-ui-router',
        job_workflow_ref:
          'simshanith/lit-ui-router/.github/workflows/publish-npm.yml@refs/tags/lit-ui-router@1.0.0',
        run_id: '100',
        run_attempt: 1,
        sha: SHA,
        actor: null,
      },
    ]);
    assert.deepEqual(await all('versions'), []);
  });

  describe('findPackages', () => {
    const tag = (name: string, tagName: string, version: string) =>
      db
        .prepare(
          "INSERT INTO dist_tags (name, tag, version, updated_at) VALUES (?, ?, ?, 'then')",
        )
        .bind(name, tagName, version)
        .run();

    const summary = async () =>
      (await run(findPackages)).map(({ name, latest }) => ({
        name,
        latest: latest && `${latest.version} ${latest.status}`,
      }));

    it('reads an empty ledger as no packages', async () => {
      assert.deepEqual(await run(findPackages), []);
    });

    it('reads each package by name with its latest row, or null without one', async () => {
      await seed({ ...ROWS.released, name: 'zeta' });
      await seed({ ...ROWS.tagged, name: 'zeta', version: '2.0.0-rc.0' });
      await tag('zeta', 'latest', VERSION);
      await tag('zeta', 'next', '2.0.0-rc.0');
      await seed({ ...ROWS.tagged, name: 'alpha' });
      await tag('alpha', 'next', VERSION);
      await seed({ ...ROWS.published, name: 'mid' });
      await tag('mid', 'latest', VERSION);

      assert.deepEqual(await summary(), [
        { name: 'alpha', latest: null },
        { name: 'mid', latest: `${VERSION} published` },
        { name: 'zeta', latest: `${VERSION} released` },
      ]);

      const [, , zeta] = await run(findPackages);
      assert.deepEqual(zeta?.latest, {
        ...ROWS.released,
        name: 'zeta',
        npm_state: 'active',
        gh_state: 'final',
        status: 'released',
      });
    });
  });

  it('records a dead-lettered body that is not a claim as undecodable', async () => {
    const message = messageOf({ name: NAME });

    await deliver([message], undefined, DEAD_LETTER_QUEUE);

    assert.equal(message.acks, 1);
    assert.deepEqual(
      (await all('claims')).map(({ outcome, name }) => ({ outcome, name })),
      [{ outcome: 'undecodable', name: null }],
    );
  });

  it('keeps the outcome a claim committed before its ack was lost to the dead-letter queue', async () => {
    const message = messageOf(claimOf());

    await deliver([message]);
    await deliver([message], undefined, DEAD_LETTER_QUEUE);

    assert.equal(message.acks, 2);
    assert.deepEqual(
      (await all('claims')).map(({ outcome }) => outcome),
      ['applied'],
    );
  });
});
