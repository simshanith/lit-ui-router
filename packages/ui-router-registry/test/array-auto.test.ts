import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { RawParams, StateDeclaration } from '@uirouter/core';

// The read-back shapes `src/specs/array-auto.test-d.ts` types, as core 6.1 produces them.

const states = [
  { name: 'plain', url: '/plain?id' },
  { name: 'auto', url: '/auto?id', params: { id: { array: 'auto' } } },
  {
    name: 'autoint',
    url: '/autoint?id',
    params: { id: { array: 'auto', type: 'int' } },
  },
  {
    name: 'autosuffix',
    url: '/autosuffix?id[]',
    params: { 'id[]': { array: 'auto' } },
  },
  {
    name: 'autodefault',
    url: '/autodefault?id',
    params: { id: { array: 'auto', value: 'x' } },
  },
  {
    name: 'mixed',
    url: '/mixed?auto&many&one',
    params: {
      auto: { array: 'auto' },
      many: { array: true },
      one: { array: false },
    },
  },
  { name: 'mixed.child', url: '/child?extra' },
] as const satisfies readonly StateDeclaration[];

const createRouter = () => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);

  for (const state of states) router.stateRegistry.register({ ...state });

  return router;
};

const go = async (name: string, params: RawParams) => {
  const router = createRouter();
  await router.stateService.go(name, params);
  const { '#': _hash, ...read } = router.globals.params;

  return { read, url: router.urlService.url() };
};

const fromUrl = async (url: string) => {
  const router = createRouter();

  const done = new Promise<unknown>((resolve) => {
    router.transitionService.onSuccess({}, resolve);
  });

  router.urlService.url(url);
  router.urlService.sync();
  await done;
  const { '#': _hash, ...read } = router.globals.params;

  return read;
};

describe('a query param in auto array mode', () => {
  for (const name of ['plain', 'auto'] as const) {
    describe(name, () => {
      it('keeps two or more values as an array', async () => {
        assert.deepEqual(await go(name, { id: ['a', 'b'] }), {
          read: { id: ['a', 'b'] },
          url: `/${name}?id=a&id=b`,
        });
      });

      it('unwraps one value passed as an array', async () => {
        assert.deepEqual((await go(name, { id: ['a'] })).read, { id: 'a' });
      });

      it('reads one value back as is', async () => {
        assert.deepEqual((await go(name, { id: 'a' })).read, { id: 'a' });
      });

      it('reads a repeated url key back as an array', async () => {
        assert.deepEqual(await fromUrl(`/${name}?id=a&id=b`), {
          id: ['a', 'b'],
        });
        assert.deepEqual(await fromUrl(`/${name}?id=a`), { id: 'a' });
      });

      it('reads an absent param back as undefined', async () => {
        assert.deepEqual((await go(name, {})).read, { id: undefined });
      });
    });
  }

  it('decodes each element with a declared type', async () => {
    assert.deepEqual(await fromUrl('/autoint?id=1&id=2'), { id: [1, 2] });
    assert.deepEqual(await fromUrl('/autoint?id=1'), { id: 1 });
  });

  it("lets an explicit `array: 'auto'` beat the `[]` suffix", async () => {
    assert.deepEqual((await go('autosuffix', { 'id[]': ['a'] })).read, {
      'id[]': 'a',
    });
    assert.deepEqual((await go('autosuffix', { 'id[]': ['a', 'b'] })).read, {
      'id[]': ['a', 'b'],
    });
  });

  it('fills a scalar default in as is', async () => {
    assert.deepEqual((await go('autodefault', {})).read, { id: 'x' });
    assert.deepEqual((await go('autodefault', { id: ['a', 'b'] })).read, {
      id: ['a', 'b'],
    });
  });

  it('leaves neighbours, and a child, in their own modes', async () => {
    assert.deepEqual(
      (
        await go('mixed.child', {
          auto: ['a'],
          many: ['a'],
          one: 'a',
          extra: ['a', 'b'],
        })
      ).read,
      { auto: 'a', many: ['a'], one: 'a', extra: ['a', 'b'] },
    );
  });

  it('is rejected outside the query', () => {
    const router = new UIRouter();
    router.plugin(servicesPlugin);

    for (const state of [
      { name: 'path', url: '/path/:id', params: { id: { array: 'auto' } } },
      { name: 'config', params: { id: { array: 'auto' } } },
    ] as const) {
      assert.throws(
        () => router.stateRegistry.register({ ...state }),
        /'auto' array mode is for query parameters only/,
      );
    }
  });
});
