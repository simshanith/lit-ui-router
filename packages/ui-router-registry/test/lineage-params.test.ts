import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { memoryLocationPlugin, servicesPlugin, UIRouter } from '@uirouter/core';
import type { RawParams, StateDeclaration } from '@uirouter/core';

// The read-back shapes `src/specs/lineage-params.test-d.ts` types, as core 6.1 produces them.

const states = [
  { name: 'lplain', url: '/lplain?id' },
  { name: 'lplain.auto', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'lplain.int', url: '/i?{id:int}' },
  { name: 'lplain.path', url: '/a/:id' },
  { name: 'lauto', url: '/lauto?id', params: { id: { array: 'auto' } } },
  { name: 'lauto.plain', url: '/c?id' },
  { name: 'lauto.true', url: '/t?id', params: { id: { array: true } } },
  { name: 'lauto.config', url: '/cfg', params: { id: 'childDefault' } },
  { name: 'lauto.config.deep', url: '/d', params: { id: 'deep' } },
  { name: 'lfalse', url: '/lfalse?id', params: { id: { array: false } } },
  { name: 'lfalse.auto', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'ltrue', url: '/ltrue?id', params: { id: { array: true } } },
  { name: 'ltrue.auto', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'lpath', url: '/lpath/:id' },
  { name: 'lpath.auto', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'lpath.path', url: '/c/:id' },
  { name: 'lpath.default', url: '/d?id', params: { id: 'cd' } },
  { name: 'lpath.config', url: '/f', params: { id: { value: 'cd' } } },
  { name: 'lint', url: '/lint?{id:int}' },
  { name: 'lint.plain', url: '/c?id' },
  { name: 'lint.config', url: '/f', params: { id: 'd' } },
  { name: 'lauto.typed', url: '/typed', params: { id: { type: 'int' } } },
  { name: 'ldefault', url: '/ldefault?id', params: { id: 'pd' } },
  { name: 'ldefault.plain', url: '/c?id' },
  { name: 'ldefault.path', url: '/a/:id' },
  {
    name: 'ldynamic',
    url: '/ldynamic?id',
    params: { id: { value: 'pd', dynamic: true } },
  },
  { name: 'ldynamic.plain', url: '/c?id' },
  { name: 'lcfg', url: '/lcfg', params: { id: 5 } },
  { name: 'lcfg.url', url: '/c?id' },
  { name: 'lcfg.config', url: '/f', params: { id: 'cd' } },
  { name: 'lg', url: '/lg?{id:int}' },
  { name: 'lg.p', url: '/p?id', params: { id: { array: true } } },
  { name: 'lg.p.c', url: '/c?id', params: { id: { array: 'auto' } } },
  { name: 'lg.mid', url: '/m' },
  { name: 'lg.mid.c', url: '/c?id' },
  { name: 'lprop', url: '/lprop?{id:int}' },
  {
    name: 'lpropchild',
    parent: 'lprop',
    url: '/c?id',
    params: { id: { array: 'auto' } },
  },
  { name: 'l6', url: '/l6?id' },
  { name: 'l6.b', url: '/2?id', params: { id: { array: true } } },
  { name: 'l6.b.c', url: '/3?id', params: { id: { array: false } } },
  { name: 'l6.b.c.d', url: '/4?id', params: { id: { array: 'auto' } } },
  { name: 'l6.b.c.d.e', url: '/5?{id:any}' },
  { name: 'l6.b.c.d.e.f', url: '/6?id', params: { id: { value: 'six' } } },
  { name: 'passq', url: '/passq?id' },
  { name: 'passq.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passq.sq', url: '/sq', params: { id: { squash: true } } },
  { name: 'passq.vu', url: '/vu', params: { id: { value: undefined } } },
  { name: 'passq.vf', url: '/vf', params: { id: { value: () => undefined } } },
  { name: 'passq.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passq.vn', url: '/vn', params: { id: { value: null } } },
  { name: 'passq.sh', url: '/sh', params: { id: 'd' } },
  { name: 'passp', url: '/passp/:id' },
  { name: 'passp.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passp.vu', url: '/vu', params: { id: { value: undefined } } },
  { name: 'passp.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passp.vd.q', url: '/q?id' },
  { name: 'passp.vn', url: '/vn', params: { id: { value: null } } },
  { name: 'passp.sh', url: '/sh', params: { id: 'd' } },
  { name: 'passp.qu', url: '/qu?id', params: { id: { value: undefined } } },
  { name: 'passa', url: '/passa?id', params: { id: { array: 'auto' } } },
  { name: 'passa.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passa.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passt', url: '/passt?id', params: { id: { array: true } } },
  { name: 'passt.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passt.sh', url: '/sh', params: { id: 'd' } },
  { name: 'passi', url: '/passi?{id:int}' },
  { name: 'passi.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passi.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passi.vn', url: '/vn', params: { id: { value: null } } },
  { name: 'passi.qd', url: '/qd?id', params: { id: 'd' } },
  { name: 'passe', url: '/passe/:id', params: { id: { array: true } } },
  { name: 'passe.dyn', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passe.vd', url: '/vd', params: { id: { value: 'd' } } },
  { name: 'passe.vn', url: '/vn', params: { id: { value: null } } },
  { name: 'passg', url: '/passg?id' },
  { name: 'passg.p', url: '/p', params: { id: { dynamic: true } } },
  { name: 'passg.p.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passm', url: '/passm?{id:int}' },
  { name: 'passm.p', url: '/p', params: { id: { dynamic: true } } },
  { name: 'passm.p.c', url: '/c?id' },
  { name: 'passn', url: '/passn', params: { id: { dynamic: true } } },
  { name: 'passn.c', url: '/c', params: { id: { dynamic: true } } },
  { name: 'passn5', url: '/passn5', params: { id: 5 } },
  { name: 'passn5.c', url: '/c', params: { id: { dynamic: true } } },
] as const satisfies readonly StateDeclaration[];

const createRouter = () => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);

  for (const state of states) router.stateRegistry.register({ ...state });

  return router;
};

const read = (router: UIRouter) => {
  const { '#': _hash, ...params } = router.globals.params;

  return params;
};

const go = async (name: string, params: RawParams) => {
  const router = createRouter();
  await router.stateService.go(name, params);

  return { read: read(router), url: router.urlService.url() };
};

const fromUrl = async (url: string) => {
  const router = createRouter();

  const done = new Promise<unknown>((resolve) => {
    router.transitionService.onSuccess({}, resolve);
  });

  router.urlService.url(url);
  router.urlService.sync();
  await done;

  return { state: router.globals.current.name, read: read(router) };
};

const rejects = (name: string, params: RawParams) =>
  assert.rejects(
    createRouter().stateService.go(name, params),
    (rejection: { detail: unknown }) =>
      String(rejection.detail).includes('parameter values are not valid'),
  );

describe('a param a child redeclares', () => {
  describe('reads back the nearest declaration', () => {
    it('in its array mode', async () => {
      assert.deepEqual((await go('lplain.auto', { id: ['a', 'b'] })).read, {
        id: ['a', 'b'],
      });
      assert.deepEqual((await go('lfalse.auto', { id: 'a' })).read, {
        id: 'a',
      });
      assert.deepEqual((await go('ltrue.auto', { id: ['a'] })).read, {
        id: 'a',
      });
      assert.deepEqual((await go('lauto.true', { id: 'a' })).read, {
        id: ['a'],
      });
      assert.deepEqual((await go('lauto.plain', { id: 'a' })).read, {
        id: 'a',
      });
    });

    it('from a url, whatever the parent decodes', async () => {
      for (const parent of ['lplain', 'lfalse', 'ltrue'] as const) {
        assert.deepEqual(await fromUrl(`/${parent}/c?id=a&id=b`), {
          state: `${parent}.auto`,
          read: { id: ['a', 'b'] },
        });
      }

      assert.deepEqual(await fromUrl('/lpath/x/c?id=a&id=b'), {
        state: 'lpath.auto',
        read: { id: ['a', 'b'] },
      });
    });

    it('in its type', async () => {
      assert.deepEqual((await go('lint.plain', { id: '5' })).read, {
        id: '5',
      });
      assert.deepEqual((await go('lplain.int', { id: 5 })).read, { id: 5 });
      assert.deepEqual((await go('lauto.typed', { id: 5 })).read, { id: 5 });
    });

    it('in its location', async () => {
      assert.deepEqual(await go('lplain.path', { id: 'z' }), {
        read: { id: 'z' },
        url: '/lplain/a/z?id=z',
      });
      assert.deepEqual(await go('lpath.path', { id: 'z' }), {
        read: { id: 'z' },
        url: '/lpath/z/c/z',
      });
      assert.deepEqual((await go('lpath.auto', { id: 'z' })).read, {
        id: 'z',
      });
    });

    it('without an ancestor default the child leaves unset', async () => {
      assert.deepEqual((await go('ldefault.plain', {})).read, {
        id: undefined,
      });
      assert.deepEqual((await go('ldynamic.plain', {})).read, {
        id: undefined,
      });
      assert.deepEqual((await go('lcfg.url', {})).read, { id: undefined });
      assert.deepEqual((await go('lcfg.config', {})).read, { id: 'cd' });
    });

    it('through three levels and a `parent:` lineage', async () => {
      assert.deepEqual((await go('lg.p.c', { id: ['1'] })).read, { id: '1' });
      assert.deepEqual((await fromUrl('/lg/m/c?id=5')).read, { id: '5' });
      assert.deepEqual((await go('lpropchild', { id: [1, 2] })).read, {
        id: ['1', '2'],
      });
    });

    it('six levels down', async () => {
      assert.deepEqual((await go('l6.b.c.d.e.f', {})).read, { id: 'six' });

      for (const [name, id] of [
        ['l6.b', ['a']],
        ['l6.b.c', 'a'],
        ['l6.b.c.d', 'a'],
        ['l6.b.c.d.e', 'a'],
      ] as const) {
        assert.deepEqual((await go(name, { id: ['a'] })).read, { id });
      }
    });

    it('while a parent reads its own declaration as the target', async () => {
      assert.deepEqual((await go('lint', { id: 5 })).read, { id: 5 });
      assert.deepEqual((await go('lpath', { id: 'z' })).read, { id: 'z' });
    });
  });

  describe("passes an ancestor's url value through an untyped non-url child", () => {
    it('as the ancestor decoded it', async () => {
      assert.deepEqual(await fromUrl('/lauto/cfg?id=a&id=b'), {
        state: 'lauto.config',
        read: { id: ['a', 'b'] },
      });
      assert.deepEqual((await fromUrl('/lauto/cfg/d?id=a&id=b')).read, {
        id: ['a', 'b'],
      });
      assert.deepEqual((await fromUrl('/lint/f?id=5')).read, { id: 5 });
      assert.deepEqual((await fromUrl('/lpath/x/f')).read, { id: 'x' });
    });

    it('or fills its own default', async () => {
      assert.deepEqual((await go('lauto.config', {})).read, {
        id: 'childDefault',
      });
    });

    it('unless it declares a type', async () => {
      assert.deepEqual((await fromUrl('/lauto/typed?id=5')).read, { id: 5 });
    });
  });

  describe('checks the value it takes against every declaration', () => {
    it('rejects what an ancestor rejects', async () => {
      await rejects('lg.mid.c', { id: 'x' });
      await rejects('lpropchild', { id: ['a', 'b'] });
    });

    it('requires what an ancestor requires', async () => {
      await rejects('lpath.auto', {});
      await rejects('ldefault.path', {});
    });

    it("lets the child's default fill an ancestor's required key", async () => {
      assert.deepEqual(await go('lpath.default', {}), {
        read: { id: 'cd' },
        url: '/lpath/cd/d?id=cd',
      });
      assert.deepEqual((await go('lpath.config', {})).read, { id: 'cd' });
    });
  });

  it('writes a query key once per declaration', async () => {
    const { url } = await go('lplain.auto', { id: 'a' });

    assert.equal(url, '/lplain/c?id=a&id=a');
    assert.deepEqual((await fromUrl(url)).read, { id: ['a', 'a'] });
  });
});

describe('a pass-through redeclaration, core `any`', () => {
  const reads = async (
    cases: readonly (readonly [string, RawParams, unknown])[],
  ) => {
    for (const [name, params, id] of cases) {
      assert.deepEqual((await go(name, params)).read, { id }, name);
    }
  };

  it('reads `undefined` when every declaration lets the key go unset', async () => {
    await reads([
      ['passq.dyn', {}, undefined],
      ['passq.sq', {}, undefined],
      ['passq.vu', {}, undefined],
      ['passq.vf', {}, undefined],
      ['passa.dyn', {}, undefined],
      ['passt.dyn', {}, undefined],
      ['passi.dyn', {}, undefined],
      ['passe.dyn', {}, undefined],
      ['passg.p.c', {}, undefined],
      ['passm.p.c', {}, undefined],
      ['passn.c', {}, undefined],
      ['passn5.c', {}, undefined],
    ]);
    assert.deepEqual(await fromUrl('/passq/c'), {
      state: 'passq.dyn',
      read: { id: undefined },
    });
    assert.deepEqual((await fromUrl('/passe//c')).read, { id: undefined });
  });

  it('or its own default', async () => {
    await reads([
      ['passq.vd', {}, 'd'],
      ['passq.sh', {}, 'd'],
      ['passq.vn', {}, null],
      ['passp.vd', {}, 'd'],
      ['passp.sh', {}, 'd'],
      ['passa.vd', {}, 'd'],
      ['passt.sh', {}, 'd'],
      ['passi.vn', {}, null],
      ['passe.vd', {}, 'd'],
    ]);
  });

  it('takes and reads back what its ancestors take', async () => {
    await reads([
      ['passq.dyn', { id: 'x' }, 'x'],
      ['passp.dyn', { id: 'x' }, 'x'],
      ['passp.vu', { id: 'x' }, 'x'],
      ['passa.dyn', { id: ['a', 'b'] }, ['a', 'b']],
      ['passt.dyn', { id: 'x' }, 'x'],
      ['passt.dyn', { id: ['a', 'b'] }, ['a', 'b']],
      ['passi.dyn', { id: 5 }, 5],
      ['passi.vd', { id: 5 }, 5],
      ['passe.dyn', { id: ['a', 'b'] }, ['a', 'b']],
      ['passg.p.c', { id: 'x' }, 'x'],
      ['passm.p.c', { id: 5 }, '5'],
      ['passn.c', { id: 'x' }, 'x'],
      ['passn5.c', { id: 5 }, 5],
      ['lcfg.config', { id: 5 }, 5],
    ]);
    assert.deepEqual((await fromUrl('/passt/c?id=a')).read, { id: ['a'] });
    assert.deepEqual((await fromUrl('/passg/p/c?id=a')).read, { id: 'a' });
  });

  it("rejects what an ancestor rejects, the child's default included", async () => {
    for (const name of [
      'passp.dyn',
      'passp.vu',
      'passp.vn',
      'passp.vd.q',
      'passp.qu',
      'passi.vd',
      'passi.qd',
      'passe.vn',
    ]) {
      await rejects(name, {});
    }

    await rejects('passi.dyn', { id: 'x' });
    await rejects('passm.p.c', { id: 'x' });
  });
});
