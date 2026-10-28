// GET /ledger against a locally generated key set standing in for GitHub's.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { ROWS } from '@tools/release-ledger/fixtures';
import { Effect } from 'effect';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose';

import type { OidcClaims } from './claim.ts';
import { type IngestEnv, ingest } from './ingest.ts';
import type { LedgerSnapshot } from './ledger-sql.ts';
import { ISSUER } from './oidc.ts';
import { type ReadEnv, readLedger } from './read.ts';

const READ_AUDIENCE = 'https://release-ledger.test/ledger';

const WRITE_AUDIENCE = 'https://release-ledger.test';

const READ_WORKFLOW =
  'simshanith/lit-ui-router/.github/workflows/release-signals.yml';

const PUBLISH_WORKFLOW =
  'simshanith/lit-ui-router/.github/workflows/publish-npm.yml';

// A workflow_call from publish-npm: job_workflow_ref names the called file.
const CLAIMS: OidcClaims = {
  repository: 'simshanith/lit-ui-router',
  repository_id: '1025140115',
  repository_owner_id: '135388',
  job_workflow_ref: `${READ_WORKFLOW}@refs/tags/lit-ui-router@1.0.0`,
  run_id: '200',
  run_attempt: '1',
  sha: '0123456789abcdef0123456789abcdef01234567',
  ref: 'refs/tags/lit-ui-router@1.0.0',
  event_name: 'push',
};

const SNAPSHOT: LedgerSnapshot = {
  versions: [
    {
      ...ROWS.released,
      npm_state: 'active',
      gh_state: 'final',
      status: 'released',
    },
  ],
  distTags: [
    {
      name: ROWS.released.name,
      tag: 'latest',
      version: ROWS.released.version,
      updated_at: 'then',
    },
  ],
};

const ENV: ReadEnv = {
  OIDC_READ_AUDIENCE: READ_AUDIENCE,
  OIDC_REPOSITORY: CLAIMS.repository,
  OIDC_REPOSITORY_ID: CLAIMS.repository_id,
  OIDC_REPOSITORY_OWNER_ID: CLAIMS.repository_owner_id,
  OIDC_READ_WORKFLOWS: [READ_WORKFLOW],
};

let keys: JWTVerifyGetKey;

let sign: (claims: Partial<OidcClaims>, audience?: string) => Promise<string>;

before(async () => {
  const pair = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };

  keys = createLocalJWKSet({ keys: [jwk] });
  sign = (claims, audience = READ_AUDIENCE) =>
    new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(pair.privateKey);
});

const get = (token: string | undefined, method = 'GET') =>
  new Request('https://ledger.test/ledger', {
    method,
    headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
  });

const read = (
  request: Request,
  env: ReadEnv = ENV,
  snapshot: Effect.Effect<LedgerSnapshot, string> = Effect.succeed(SNAPSHOT),
) => readLedger(request, env, snapshot, keys);

describe('GET /ledger', () => {
  it('answers the snapshot to a release-signals run, uncached', async () => {
    const response = await read(get(await sign(CLAIMS)));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), SNAPSHOT);
  });

  it('needs no environment and accepts the weekly sweep on main', async () => {
    const token = await sign({
      ...CLAIMS,
      job_workflow_ref: `${READ_WORKFLOW}@refs/heads/main`,
      ref: 'refs/heads/main',
      event_name: 'schedule',
      environment: 'publish',
    });

    assert.equal((await read(get(token))).status, 200);
  });

  it('answers 401 without a bearer token or with the publish audience', async () => {
    assert.equal((await read(get(undefined))).status, 401);
    assert.equal(
      (await read(get(await sign(CLAIMS, WRITE_AUDIENCE)))).status,
      401,
    );
  });

  it('answers 403 to the publish workflow under the read audience', async () => {
    const token = await sign({
      ...CLAIMS,
      job_workflow_ref: `${PUBLISH_WORKFLOW}@refs/tags/lit-ui-router@1.0.0`,
      environment: 'publish',
    });

    const response = await read(get(token));

    assert.equal(response.status, 403);
    assert.equal(await response.text(), 'job_workflow_ref is not allowed');
  });

  const pins: [string, Partial<OidcClaims>][] = [
    ['repository', { repository: 'fork/lit-ui-router' }],
    ['repository_id', { repository_id: '1' }],
    ['repository_owner_id', { repository_owner_id: '1' }],
    ['event_name', { event_name: 'pull_request' }],
  ];

  for (const [pin, claims] of pins) {
    it(`answers 403 when ${pin} is not the read run's`, async () => {
      const response = await read(get(await sign({ ...CLAIMS, ...claims })));

      assert.equal(response.status, 403);
      assert.equal(await response.text(), `${pin} is not allowed`);
    });
  }

  it('answers 503 when D1 fails, and 405 to other methods', async () => {
    assert.equal(
      (await read(get(await sign(CLAIMS)), ENV, Effect.fail('down'))).status,
      503,
    );
    assert.equal((await read(get(undefined, 'POST'))).status, 405);
  });

  it('answers 500, and never skips verification, when the read audience is unset', async () => {
    const env = { ...ENV, OIDC_READ_AUDIENCE: undefined };

    assert.equal((await read(get(await sign(CLAIMS)), env)).status, 500);
  });
});

describe('POST /claims with a read token', () => {
  it('answers 401: the read audience is not the publish one', async () => {
    const env: IngestEnv = {
      OIDC_AUDIENCE: WRITE_AUDIENCE,
      OIDC_REPOSITORY: CLAIMS.repository,
      OIDC_REPOSITORY_ID: CLAIMS.repository_id,
      OIDC_REPOSITORY_OWNER_ID: CLAIMS.repository_owner_id,
      OIDC_WORKFLOWS: [PUBLISH_WORKFLOW],
      OIDC_ENVIRONMENT: 'publish',
      LEDGER_QUEUE: { send: () => Promise.resolve() },
    };

    const response = await ingest(
      new Request('https://ledger.test/claims', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await sign(CLAIMS)}` },
        body: JSON.stringify({ name: 'lit-ui-router', version: '1.0.0' }),
      }),
      env,
      keys,
    );

    assert.equal(response.status, 401);
  });
});
