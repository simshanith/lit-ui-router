// Exploration (#1435 x #349): the same requests through the three guard
// byWiring, so their answers can be compared row by row.
import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { Effect } from 'effect';
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
  SignJWT,
} from 'jose';
import type { FetchHandler } from 'ui-router-server/fetch';

import type { Claim, OidcClaims } from './claim.ts';
import type { LedgerSnapshot } from './ledger-sql.ts';
import { ISSUER } from './oidc.ts';
import {
  guardBeforeDelegation,
  guardInHandlers,
  type RoutesEnv,
  type Wiring,
} from './routes.ts';

const PUBLISH_AUDIENCE = 'https://release-ledger.test';

const READ_AUDIENCE = 'https://release-ledger.test/ledger';

const WORKFLOWS = 'simshanith/lit-ui-router/.github/workflows';

const RUN: Omit<OidcClaims, 'job_workflow_ref'> = {
  repository: 'simshanith/lit-ui-router',
  repository_id: '1025140115',
  repository_owner_id: '135388',
  run_id: '100',
  run_attempt: '1',
  sha: '0123456789abcdef0123456789abcdef01234567',
  ref: 'refs/tags/lit-ui-router@1.0.0',
  event_name: 'push',
  environment: 'publish',
};

const PUBLISH: OidcClaims = {
  ...RUN,
  job_workflow_ref: `${WORKFLOWS}/publish-npm.yml@refs/tags/lit-ui-router@1.0.0`,
};

const READ: OidcClaims = {
  ...RUN,
  job_workflow_ref: `${WORKFLOWS}/release-signals.yml@refs/heads/main`,
};

const BODY = JSON.stringify({ name: 'lit-ui-router', version: '1.0.0' });

const SNAPSHOT: LedgerSnapshot = { versions: [], distTags: [] };

let keys: JWTVerifyGetKey;

let sign: (claims: OidcClaims, audience: string) => Promise<string>;

before(async () => {
  const pair = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'RS256' };

  keys = createLocalJWKSet({ keys: [jwk] });
  sign = (claims, audience) =>
    new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(pair.privateKey);
});

const envWith = (send: (claim: Claim) => Promise<void>): RoutesEnv => ({
  OIDC_AUDIENCE: PUBLISH_AUDIENCE,
  OIDC_READ_AUDIENCE: READ_AUDIENCE,
  OIDC_REPOSITORY: RUN.repository,
  OIDC_REPOSITORY_ID: RUN.repository_id,
  OIDC_REPOSITORY_OWNER_ID: RUN.repository_owner_id,
  OIDC_WORKFLOWS: [`${WORKFLOWS}/publish-npm.yml`],
  OIDC_READ_WORKFLOWS: [`${WORKFLOWS}/release-signals.yml`],
  OIDC_ENVIRONMENT: 'publish',
  LEDGER_QUEUE: { send },
});

const ENV = envWith(() => Promise.resolve());

const wiringWith = (overrides: Partial<Wiring<RoutesEnv>> = {}) => ({
  snapshot: () => Effect.succeed(SNAPSHOT),
  run: <A>(_name: string, effect: Effect.Effect<A>) =>
    Effect.runPromise(effect),
  keys,
  ...overrides,
});

const WIRINGS = {
  '(a) guard in handlers': () => guardInHandlers(wiringWith()),
  '(b) guard answers a Response': () =>
    guardBeforeDelegation(wiringWith(), 'response'),
  '(c) guard returns a denial': () =>
    guardBeforeDelegation(wiringWith(), 'denial'),
} satisfies Record<string, () => FetchHandler<[RoutesEnv]>>;

const request = (
  path: string,
  {
    token,
    headers = {},
    ...init
  }: Omit<RequestInit, 'headers'> & {
    token?: string;
    headers?: Record<string, string>;
  } = {},
): Request =>
  new Request(`https://ledger.test${path}`, {
    ...init,
    headers: {
      ...(token !== undefined && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
  });

/** Status and the headers a guard or the adapter might add. */
const summary = (response: Response | null) =>
  response === null
    ? null
    : {
        status: response.status,
        allow: response.headers.get('Allow'),
        challenge: response.headers.get('WWW-Authenticate'),
        cache: response.headers.get('Cache-Control'),
      };

const answers = async (make: () => Request) => {
  const out: Record<string, ReturnType<typeof summary>> = {};

  for (const [name, build] of Object.entries(WIRINGS))
    out[name] = summary(await build()(make(), ENV));

  return out;
};

const same = (value: ReturnType<typeof summary>) =>
  Object.fromEntries(Object.keys(WIRINGS).map((name) => [name, value]));

const plain = (
  status: number,
  extra: Partial<NonNullable<ReturnType<typeof summary>>> = {},
) => ({
  status,
  allow: null,
  challenge: null,
  cache: null,
  ...extra,
});

describe('guard ordering: the same requests through each name', () => {
  it('answers 401 without a token; only the denial name adds a challenge and no-store', async () => {
    const byWiring = await answers(() =>
      request('/claims', { method: 'POST', body: BODY }),
    );

    assert.deepEqual(byWiring, {
      '(a) guard in handlers': plain(401),
      '(b) guard answers a Response': plain(401),
      '(c) guard returns a denial': plain(401, {
        challenge: 'Bearer',
        cache: 'no-store',
      }),
    });
  });

  it('answers 405 before 401 for a wrong method without a token, in every name', async () => {
    assert.deepEqual(
      await answers(() => request('/claims')),
      same(plain(405, { allow: 'POST' })),
    );
  });

  it('answers 401 to a publish token on /ledger (wrong audience)', async () => {
    const token = await sign(PUBLISH, PUBLISH_AUDIENCE);
    const byWiring = await answers(() => request('/ledger', { token }));

    assert.deepEqual(byWiring, {
      '(a) guard in handlers': plain(401),
      '(b) guard answers a Response': plain(401),
      '(c) guard returns a denial': plain(401, {
        challenge: 'Bearer',
        cache: 'no-store',
      }),
    });
  });

  it('answers 403 to a read token from another workflow, before delegation in (b) and (c)', async () => {
    const token = await sign(PUBLISH, READ_AUDIENCE);
    const byWiring = await answers(() => request('/ledger', { token }));

    assert.deepEqual(byWiring, {
      '(a) guard in handlers': plain(403),
      '(b) guard answers a Response': plain(403),
      '(c) guard returns a denial': plain(403, { cache: 'no-store' }),
    });
  });

  it("keeps /claims's 403 in the handler: its policy reads the body", async () => {
    const token = await sign(PUBLISH, PUBLISH_AUDIENCE);

    const byWiring = await answers(() =>
      request('/claims', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: 'lit-ui-router', version: '9.9.9' }),
      }),
    );

    // The handler's text 403 in every name; (c)'s challenge and no-store never apply.
    assert.deepEqual(byWiring, same(plain(403)));
  });

  it('answers 202 and 200 to the right tokens; /ledger keeps its own no-store', async () => {
    const publish = await sign(PUBLISH, PUBLISH_AUDIENCE);
    const read = await sign(READ, READ_AUDIENCE);

    assert.deepEqual(
      await answers(() =>
        request('/claims', { method: 'POST', token: publish, body: BODY }),
      ),
      same(plain(202)),
    );
    assert.deepEqual(
      await answers(() => request('/ledger', { token: read })),
      same(plain(200, { cache: 'no-store' })),
    );
  });

  it('admits HEAD on /ledger where methods lists GET; the handler alone refuses it', async () => {
    const token = await sign(READ, READ_AUDIENCE);

    const byWiring = await answers(() =>
      request('/ledger', { method: 'HEAD', token }),
    );

    assert.deepEqual(byWiring, {
      '(a) guard in handlers': plain(405, { allow: 'GET' }),
      '(b) guard answers a Response': plain(200, { cache: 'no-store' }),
      '(c) guard returns a denial': plain(200, { cache: 'no-store' }),
    });
  });

  it('passes every other request as null, navigations included', async () => {
    for (const make of [
      () => request('/'),
      () => request('/releases', { headers: { Accept: 'text/html' } }),
      () => request('/claims/1', { method: 'POST' }),
    ])
      assert.deepEqual(await answers(make), same(null));
  });
});

describe('throw policy: a queue send that rejects', () => {
  const failing = envWith(() => Promise.reject(new Error('queue down')));

  const post = async () =>
    request('/claims', {
      method: 'POST',
      token: await sign(PUBLISH, PUBLISH_AUDIENCE),
      body: BODY,
    });

  it('rethrows to the host by default', async () => {
    await assert.rejects(guardInHandlers(wiringWith())(await post(), failing));
  });

  it('answers through onError when the host opts in', async () => {
    const handle = guardInHandlers(
      wiringWith({
        onError: () => new Response('the ledger failed', { status: 500 }),
      }),
    );

    const response = await handle(await post(), failing);

    assert.equal(response?.status, 500);
    assert.equal(await response?.text(), 'the ledger failed');
  });

  it('keeps a failed D1 read a handler-owned 503, never a throw', async () => {
    const handle = guardInHandlers(
      wiringWith({ snapshot: () => Effect.fail('D1 down') }),
    );

    const token = await sign(READ, READ_AUDIENCE);

    assert.equal(
      (await handle(request('/ledger', { token }), ENV))?.status,
      503,
    );
  });
});
