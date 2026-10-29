// POST /claims against a locally generated key set standing in for GitHub's.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose';

import type { Claim, OidcClaims } from './claim.ts';
import { type IngestEnv, ingest } from './ingest.ts';
import { ISSUER, verifyToken } from './oidc.ts';

const AUDIENCE = 'https://release-ledger.test';

const WORKFLOW = 'simshanith/lit-ui-router/.github/workflows/publish-npm.yml';

const CLAIMS: OidcClaims = {
  repository: 'simshanith/lit-ui-router',
  repository_id: '1025140115',
  repository_owner_id: '135388',
  job_workflow_ref: `${WORKFLOW}@refs/tags/lit-ui-router@1.0.0`,
  run_id: '100',
  run_attempt: '1',
  sha: '0123456789abcdef0123456789abcdef01234567',
  ref: 'refs/tags/lit-ui-router@1.0.0',
  event_name: 'push',
  environment: 'publish',
};

const BODY = { name: 'lit-ui-router', version: '1.0.0' };

type TokenClaims = Partial<OidcClaims>;

let keys: JWTVerifyGetKey;

let sign: (
  claims: TokenClaims,
  options?: { audience?: string; expires?: boolean },
) => Promise<string>;

before(async () => {
  const pair = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };

  keys = createLocalJWKSet({ keys: [jwk] });
  sign = (claims, { audience = AUDIENCE, expires = true } = {}) => {
    const jwt = new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(audience)
      .setIssuedAt();

    return (expires ? jwt.setExpirationTime('5m') : jwt).sign(pair.privateKey);
  };
});

function envWith(overrides: Partial<IngestEnv> = {}) {
  const sent: Claim[] = [];

  const env: IngestEnv = {
    OIDC_AUDIENCE: AUDIENCE,
    OIDC_REPOSITORY: CLAIMS.repository,
    OIDC_REPOSITORY_ID: CLAIMS.repository_id,
    OIDC_REPOSITORY_OWNER_ID: CLAIMS.repository_owner_id,
    OIDC_WORKFLOWS: [WORKFLOW],
    OIDC_ENVIRONMENT: 'publish',
    LEDGER_QUEUE: {
      send: (claim) => {
        sent.push(claim);

        return Promise.resolve();
      },
    },
    ...overrides,
  };

  return { env, sent };
}

const postText = (token: string | undefined, body: string) =>
  new Request('https://ledger.test/claims', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token !== undefined && { Authorization: `Bearer ${token}` }),
    },
    body,
  });

const post = (
  token: string | undefined,
  body: Readonly<Record<string, string>> = BODY,
) => postText(token, JSON.stringify(body));

/** An unsigned token, for the dev path that skips verification. */
const unsigned = (claims: TokenClaims): string =>
  [{ alg: 'none' }, claims]
    .map((part) => Buffer.from(JSON.stringify(part)).toString('base64url'))
    .join('.') + '.';

describe('verifyToken', () => {
  it('returns the run claims of a genuine token', async () => {
    assert.deepEqual(
      await verifyToken(await sign(CLAIMS), AUDIENCE, keys),
      CLAIMS,
    );
  });

  it('rejects another audience', async () => {
    await assert.rejects(
      verifyToken(await sign(CLAIMS, { audience: 'other' }), AUDIENCE, keys),
      { _tag: 'InvalidToken' },
    );
  });

  it('rejects a token without the run claims', async () => {
    await assert.rejects(verifyToken(await sign({}), AUDIENCE, keys), {
      _tag: 'InvalidToken',
      reason: 'the token lacks the GitHub run claims',
    });
  });
});

describe('POST /claims', () => {
  it('enqueues a verified claim and answers 202', async () => {
    const { env, sent } = envWith();
    const response = await ingest(post(await sign(CLAIMS)), env, keys);

    assert.equal(response.status, 202);
    assert.equal(sent.length, 1);
    assert.deepEqual(
      { ...sent[0], receivedAt: 'now' },
      {
        receivedAt: 'now',
        name: 'lit-ui-router',
        version: '1.0.0',
        origin: {
          kind: 'run',
          repository: CLAIMS.repository,
          jobWorkflowRef: CLAIMS.job_workflow_ref,
          runId: '100',
          runAttempt: '1',
          sha: CLAIMS.sha,
        },
      },
    );
  });

  it('builds the run origin itself, ignoring an origin in the body', async () => {
    const { env, sent } = envWith();

    const smuggled = {
      ...BODY,
      origin: {
        kind: 'manual',
        repository: CLAIMS.repository,
        sha: CLAIMS.sha,
        actor: 'mallory',
      },
    };

    const response = await ingest(
      postText(await sign(CLAIMS), JSON.stringify(smuggled)),
      env,
      keys,
    );

    assert.equal(response.status, 202);
    assert.deepEqual(
      sent.map(({ origin }) => origin.kind),
      ['run'],
    );
  });

  it('answers 401 without a bearer token', async () => {
    const { env, sent } = envWith();

    assert.equal((await ingest(post(undefined), env, keys)).status, 401);
    assert.equal(sent.length, 0);
  });

  it('answers 401 for a token signed by another key', async () => {
    const { env } = envWith();
    const other = await generateKeyPair('RS256');

    const forged = await new SignJWT({ ...CLAIMS })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('5m')
      .sign(other.privateKey);

    assert.equal((await ingest(post(forged), env, keys)).status, 401);
  });

  it('answers 401 for an unsigned token when the audience is set', async () => {
    const { env } = envWith();

    assert.equal((await ingest(post(unsigned(CLAIMS)), env, keys)).status, 401);
  });

  it('answers 401 for a token without an expiry', async () => {
    const { env, sent } = envWith();
    const endless = await sign(CLAIMS, { expires: false });

    assert.equal((await ingest(post(endless), env, keys)).status, 401);
    assert.equal(sent.length, 0);
  });

  it('answers 403 for a workflow path that only starts with the publish one', async () => {
    const { env, sent } = envWith();

    const token = await sign({
      ...CLAIMS,
      job_workflow_ref: `${WORKFLOW}@x.yml@refs/heads/main`,
    });

    const response = await ingest(post(token), env, keys);

    assert.equal(response.status, 403);
    assert.equal(await response.text(), 'job_workflow_ref is not allowed');
    assert.equal(sent.length, 0);
  });

  it('answers 400 for a body that is not a claim', async () => {
    const { env, sent } = envWith();
    const token = await sign(CLAIMS);

    assert.equal(
      (await ingest(postText(token, 'not json'), env, keys)).status,
      400,
    );
    assert.equal(
      (await ingest(post(token, { name: '../x', version: '1.0.0' }), env, keys))
        .status,
      400,
    );
    assert.equal(sent.length, 0);
  });

  it('answers 403 for repair, a maintainer event', async () => {
    const { env, sent } = envWith();

    const response = await ingest(
      post(await sign(CLAIMS), { ...BODY, action: 'repair' }),
      env,
      keys,
    );

    assert.equal(response.status, 403);
    assert.equal(sent.length, 0);
  });

  const pins: [string, TokenClaims, Record<string, string>?][] = [
    ['repository', { repository: 'fork/lit-ui-router' }],
    ['repository_id', { repository_id: '1' }],
    ['repository_owner_id', { repository_owner_id: '1' }],
    [
      'job_workflow_ref',
      {
        job_workflow_ref:
          'simshanith/lit-ui-router/.github/workflows/x.yml@refs/heads/main',
      },
    ],
    ['environment', { environment: 'preview' }],
    ['event_name', { event_name: 'pull_request_target' }],
    ['ref', {}, { name: 'lit-ui-router', version: '2.0.0' }],
  ];

  for (const [pin, claims, body] of pins) {
    it(`answers 403 when ${pin} is not the publish run's`, async () => {
      const { env, sent } = envWith();

      const response = await ingest(
        post(await sign({ ...CLAIMS, ...claims }), body),
        env,
        keys,
      );

      assert.equal(response.status, 403);
      assert.equal(await response.text(), `${pin} is not allowed`);
      assert.equal(sent.length, 0);
    });
  }

  it('accepts a workflow_dispatch run on main for any version', async () => {
    const { env } = envWith();

    const token = await sign({
      ...CLAIMS,
      ref: 'refs/heads/main',
      event_name: 'workflow_dispatch',
      job_workflow_ref: `${WORKFLOW}@refs/heads/main`,
    });

    assert.equal(
      (await ingest(post(token, { ...BODY, version: '2.0.0' }), env, keys))
        .status,
      202,
    );
  });

  it('answers 500, and never skips verification, when the audience is unset', async () => {
    const { env, sent } = envWith({ OIDC_AUDIENCE: undefined });

    assert.equal((await ingest(post(unsigned(CLAIMS)), env, keys)).status, 500);
    assert.equal(sent.length, 0);
  });

  it('skips verification only under LEDGER_DEV_SKIP_OIDC', async () => {
    const { env, sent } = envWith({
      OIDC_AUDIENCE: undefined,
      LEDGER_DEV_SKIP_OIDC: 'true',
    });

    assert.equal((await ingest(post(unsigned(CLAIMS)), env, keys)).status, 202);
    assert.equal(sent.length, 1);
  });

  it('ignores LEDGER_DEV_SKIP_OIDC while the audience is set', async () => {
    const { env, sent } = envWith({ LEDGER_DEV_SKIP_OIDC: 'true' });

    assert.equal((await ingest(post(unsigned(CLAIMS)), env, keys)).status, 401);
    assert.equal((await ingest(post(undefined), env, keys)).status, 401);
    assert.equal(
      (await ingest(post(await sign(CLAIMS)), env, keys)).status,
      202,
    );
    assert.equal(sent.length, 1);
  });

  it('still pins the claims under LEDGER_DEV_SKIP_OIDC', async () => {
    const { env } = envWith({
      OIDC_AUDIENCE: '',
      LEDGER_DEV_SKIP_OIDC: 'true',
    });

    const token = unsigned({ ...CLAIMS, environment: 'preview' });

    assert.equal((await ingest(post(token), env, keys)).status, 403);
  });

  it('answers 405 with Allow: POST for other methods', async () => {
    const { env } = envWith();

    const response = await ingest(
      new Request('https://ledger.test/claims'),
      env,
      keys,
    );

    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
  });
});
