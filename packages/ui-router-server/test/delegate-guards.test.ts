// Exploration (#1435 x #349): guards, methods and onError on delegating rows.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { Hono } from 'hono';

import { createFetchHandler } from '../src/fetch.ts';
import type { Guard } from '../src/fetch.ts';
import { serverRouterHono } from '../src/hono.ts';
import { createServerRouter } from '../src/index.ts';

const noShell = (): never => {
  throw new Error('serveShell must not be called');
};

// SAFETY: node's real Response, which the fetch globals shim shadows, has text().
const bodyText = (res: Response): Promise<string> =>
  (res as Response & { text(): Promise<string> }).text();

const routerWith = (guard: string | undefined) =>
  createServerRouter({
    mounts: {
      '/': {
        routes: [
          {
            name: 'claims',
            url: '/claims',
            delegate: 'claims',
            methods: ['POST'],
            ...(guard !== undefined && { guard }),
          },
        ],
      },
    },
  });

const accepted = (): Response => new Response('accepted', { status: 202 });

const post = (): Request =>
  new Request('https://ledger.test/claims', { method: 'POST' });

describe('delegate guards (exploration)', () => {
  it('throws at construction for a guard key the adapter does not bind', () => {
    assert.throws(
      () =>
        createFetchHandler(routerWith('publish'), {
          serveShell: noShell,
          delegates: { claims: accepted },
        }),
      /No guard in guards for guard key 'publish'/,
    );
  });

  it('rejects a guard on a row that does not delegate', () => {
    assert.throws(
      () =>
        createServerRouter({
          mounts: { '/': { routes: [{ name: 'home', url: '/', guard: 'x' }] } },
        }),
      /state 'home' declares guard but does not delegate/,
    );
  });

  it('answers 405 with Allow before the guard runs', async () => {
    let guarded = 0;

    const handle = createFetchHandler(routerWith('publish'), {
      serveShell: noShell,
      guards: {
        publish: () => {
          guarded += 1;

          return undefined;
        },
      },
      delegates: { claims: accepted },
    });

    const response = await handle(new Request('https://ledger.test/claims'));

    assert.equal(response?.status, 405);
    assert.equal(response?.headers.get('Allow'), 'POST');
    assert.equal(guarded, 0);
  });

  it("answers a guard's Response, a denial, or delegates on undefined", async () => {
    const outcomes: ReturnType<Guard>[] = [
      new Response('mine', { status: 401 }),
      { status: 401, challenge: 'Bearer', reason: 'no bearer token' },
      { status: 403 },
      undefined,
    ];

    const answers = [];

    for (const outcome of outcomes) {
      const handle = createFetchHandler(routerWith('publish'), {
        serveShell: noShell,
        guards: { publish: () => outcome },
        delegates: { claims: accepted },
      });

      const response = await handle(post());

      answers.push({
        status: response?.status,
        challenge: response?.headers.get('WWW-Authenticate') ?? null,
        cache: response?.headers.get('Cache-Control') ?? null,
        body: response === null ? null : await bodyText(response),
      });
    }

    assert.deepEqual(answers, [
      { status: 401, challenge: null, cache: null, body: 'mine' },
      {
        status: 401,
        challenge: 'Bearer',
        cache: 'no-store',
        body: 'no bearer token',
      },
      { status: 403, challenge: null, cache: 'no-store', body: '' },
      { status: 202, challenge: null, cache: null, body: 'accepted' },
    ]);
  });
});

describe('throw policy (exploration)', () => {
  const failing = (): never => {
    throw new Error('queue down');
  };

  it("rethrows a delegate's throw to the fetch host by default", async () => {
    const handle = createFetchHandler(routerWith(undefined), {
      serveShell: noShell,
      delegates: { claims: failing },
    });

    await assert.rejects(handle(post()), /queue down/);
  });

  it('answers it through onError when the host opts in', async () => {
    const handle = createFetchHandler(routerWith(undefined), {
      serveShell: noShell,
      delegates: { claims: failing },
      onError: () => new Response('failed', { status: 500 }),
    });

    assert.equal((await handle(post()))?.status, 500);
  });

  it("reaches Hono's onError by default, so a Hono host keeps its own policy", async () => {
    const app = new Hono();

    app.use(
      '*',
      serverRouterHono(routerWith(undefined), {
        serveShell: noShell,
        delegates: { claims: failing },
      }),
    );
    app.onError((error, c) => c.text(`host: ${error.message}`, 503));

    const response = await app.request('/claims', { method: 'POST' });

    assert.equal(response.status, 503);
    assert.equal(await response.text(), 'host: queue down');
  });
});
