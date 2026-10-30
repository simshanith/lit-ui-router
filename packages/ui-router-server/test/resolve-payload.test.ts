import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  servicesPlugin,
  UIRouter,
  type StateDeclaration,
} from '@uirouter/core';

import { installServerLocation } from '../src/location.ts';
import { seed, type ResolvePayload } from '../src/ssr-client.ts';
import {
  dehydrate,
  settle,
  type DehydrateCandidate,
  type DehydrateOptions,
} from '../src/ssr.ts';

interface Loop {
  self?: Loop;
}

class Sheet {
  readonly num: string;

  constructor(num: string) {
    this.num = num;
  }
}

// Every resolve function counts its calls, by state and token.
const counter = () => {
  const calls = new Map<string, number>();

  const count =
    <T>(key: string, value: () => T) =>
    () => {
      calls.set(key, (calls.get(key) ?? 0) + 1);

      return value();
    };

  return { calls, count };
};

const states = (count: ReturnType<typeof counter>['count']) => {
  const declared: StateDeclaration[] = [
    {
      name: 'app',
      url: '/app',
      resolve: {
        user: count('app.user', () => ({ name: 'Ada', roles: ['admin'] })),
      },
    },
    {
      name: 'app.sheet',
      url: '/sheet/:num?tab',
      resolve: [
        {
          token: 'title',
          deps: ['$transition$', 'user'],
          resolveFn: (
            trans: { params(): { num: string } },
            user: { name: string },
          ) =>
            count('app.sheet.title', () =>
              Promise.resolve(`${user.name}: sheet ${trans.params().num}`),
            )(),
        },
        { token: 'count', resolveFn: count('app.sheet.count', () => 7) },
        { token: 'empty', resolveFn: count('app.sheet.empty', () => null) },
        {
          token: 'drawnAt',
          resolveFn: count('app.sheet.drawnAt', () => new Date(0)),
        },
        {
          token: 'sheet',
          resolveFn: count('app.sheet.sheet', () => new Sheet('7B')),
        },
        {
          token: 'comments',
          policy: { async: 'NOWAIT' },
          resolveFn: count('app.sheet.comments', () =>
            Promise.resolve(['first']),
          ),
        },
      ],
    },
    {
      name: 'app.index',
      url: '/index',
      resolve: { list: count('app.index.list', () => ['7B', '8']) },
    },
    { name: 'old', url: '/old/:num', redirectTo: 'app.sheet' },
  ];

  return declared;
};

const makeRouter = () => {
  const { calls, count } = counter();
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  installServerLocation(router, { urlConfig: { strict: false } });
  router.stateService.defaultErrorHandler(() => {});

  for (const state of states(count)) router.stateRegistry.register(state);

  return { router, calls };
};

// What the client reads from a document block, intact or damaged.
const parse = (text: string): ResolvePayload =>
  // SAFETY: seed takes the block as parsed; the damaged cases are the point.
  JSON.parse(text) as ResolvePayload;

const roundTrip = (payload: ResolvePayload): ResolvePayload =>
  parse(JSON.stringify(payload));

const drawn = async (path: string, options?: DehydrateOptions) => {
  const { router } = makeRouter();

  return dehydrate(await settle(router, path), options);
};

const total = (calls: ReadonlyMap<string, number>): number =>
  [...calls.values()].reduce((sum, n) => sum + n, 0);

describe('dehydrate', () => {
  it('draws every plain-data resolve on the path, by state and token', async () => {
    const { payload } = await drawn('/app/sheet/7B?tab=notes');

    assert.deepEqual(payload, {
      state: 'app.sheet',
      params: { num: '7B', tab: 'notes' },
      resolves: {
        app: { user: { name: 'Ada', roles: ['admin'] } },
        'app.sheet': { title: 'Ada: sheet 7B', count: 7, empty: null },
      },
    });
    assert.deepEqual(roundTrip(payload), payload);
  });

  it('lists a value JSON would change instead of drawing it', async () => {
    const { payload, unserializable } = await drawn('/app/sheet/7B');

    assert.deepEqual(unserializable, [
      { state: 'app.sheet', token: 'drawnAt' },
      { state: 'app.sheet', token: 'sheet' },
    ]);
    assert.equal('drawnAt' in payload.resolves['app.sheet'], false);
  });

  it('leaves a NOWAIT resolve to the client: neither drawn nor listed', async () => {
    const { payload, unserializable } = await drawn('/app/sheet/7B');

    assert.equal('comments' in payload.resolves['app.sheet'], false);
    assert.equal(
      unserializable.some(({ token }) => token === 'comments'),
      false,
    );
  });

  it('draws the redirect target a redirect lands on', async () => {
    const { payload } = await drawn('/old/7B');

    assert.equal(payload.state, 'app.sheet');
    assert.deepEqual(payload.params, { num: '7B' });
  });

  it('rejects values JSON cannot carry unchanged', async () => {
    const cycle: Loop = {};
    cycle.self = cycle;
    const sparse: number[] = [];
    sparse[1] = 1;

    const values: [string, unknown][] = [
      ['undefined', undefined],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['negative zero', -0],
      ['function', () => 1],
      ['map', new Map()],
      ['nested date', { at: [new Date(0)] }],
      ['sparse array', sparse],
      ['cycle', cycle],
      ['bigint', 1n],
    ];

    const router = new UIRouter();
    router.plugin(servicesPlugin);
    installServerLocation(router);
    router.stateRegistry.register({
      name: 'odd',
      url: '/odd',
      resolve: values.map(([token, value]) => ({
        token,
        resolveFn: () => value,
      })),
    });

    const { payload, unserializable } = dehydrate(await settle(router, '/odd'));

    assert.deepEqual(payload.resolves, {});
    assert.deepEqual(
      unserializable.map(({ token }) => token),
      values.map(([token]) => token),
    );
  });
});

describe('dehydrate with shouldDehydrate', () => {
  it('keeps out the resolves it declines and draws the rest', async () => {
    const { payload, unserializable } = await drawn('/app/sheet/7B', {
      shouldDehydrate: ({ token }) => token !== 'user',
    });

    assert.deepEqual(payload.resolves, {
      'app.sheet': { title: 'Ada: sheet 7B', count: 7, empty: null },
    });
    assert.equal(
      unserializable.some(({ token }) => token === 'user'),
      false,
    );
  });

  it('tells one token apart by the state that declares it', async () => {
    const router = new UIRouter();
    router.plugin(servicesPlugin);
    installServerLocation(router);
    router.stateRegistry.register({
      name: 'site',
      url: '/site',
      resolve: { data: () => 'shared' },
    });
    router.stateRegistry.register({
      name: 'site.page',
      url: '/page',
      resolve: { data: () => 'own' },
    });

    const { payload } = dehydrate(await settle(router, '/site/page'), {
      shouldDehydrate: ({ state }) => state !== 'site',
    });

    assert.deepEqual(payload.resolves, { 'site.page': { data: 'own' } });
  });

  it('runs before the JSON check, so a declined value is not listed', async () => {
    const seen: DehydrateCandidate[] = [];

    const { unserializable } = await drawn('/app/sheet/7B', {
      shouldDehydrate: (candidate) => {
        seen.push(candidate);

        return candidate.token !== 'drawnAt';
      },
    });

    assert.deepEqual(unserializable, [{ state: 'app.sheet', token: 'sheet' }]);
    assert.ok(
      seen.find(({ token }) => token === 'drawnAt')?.value instanceof Date,
    );
  });

  it('is asked only about drawn candidates: not NOWAIT, not undeclared tokens', async () => {
    const seen: string[] = [];
    await drawn('/app/sheet/7B', {
      shouldDehydrate: ({ state, token }) => {
        seen.push(`${state}.${token}`);

        return true;
      },
    });

    assert.deepEqual(seen, [
      'app.user',
      'app.sheet.title',
      'app.sheet.count',
      'app.sheet.empty',
      'app.sheet.drawnAt',
      'app.sheet.sheet',
    ]);
  });
});

describe('seed', () => {
  it('boots with zero resolve calls for the states the payload was drawn for', async () => {
    const { payload } = await drawn('/app/sheet/7B');
    const { router, calls } = makeRouter();
    seed(router, roundTrip(payload));

    const transition = await settle(router, '/app/sheet/7B');

    assert.equal(calls.get('app.user'), undefined);
    assert.equal(calls.get('app.sheet.title'), undefined);
    assert.equal(calls.get('app.sheet.count'), undefined);
    assert.equal(calls.get('app.sheet.empty'), undefined);
    assert.deepEqual(transition.injector().get('user'), {
      name: 'Ada',
      roles: ['admin'],
    });
    assert.equal(transition.injector().get('title'), 'Ada: sheet 7B');
    assert.equal(transition.injector().get('empty'), null);
  });

  it('re-runs an unserializable resolve, its value the type it declares', async () => {
    const { payload } = await drawn('/app/sheet/7B');
    const { router, calls } = makeRouter();
    seed(router, roundTrip(payload));

    const transition = await settle(router, '/app/sheet/7B');

    assert.equal(calls.get('app.sheet.drawnAt'), 1);
    assert.equal(calls.get('app.sheet.sheet'), 1);
    assert.ok(transition.injector().get('drawnAt') instanceof Date);
    assert.ok(transition.injector().get('sheet') instanceof Sheet);
  });

  it('re-runs only the resolve shouldDehydrate kept out', async () => {
    const { payload } = await drawn('/app/sheet/7B', {
      shouldDehydrate: ({ token }) => token !== 'count',
    });

    const { router, calls } = makeRouter();
    seed(router, roundTrip(payload));

    const transition = await settle(router, '/app/sheet/7B');

    assert.equal(calls.get('app.sheet.count'), 1);
    assert.equal(transition.injector().get('count'), 7);
    assert.equal(calls.get('app.user'), undefined);
    assert.equal(calls.get('app.sheet.title'), undefined);
    assert.equal(calls.get('app.sheet.empty'), undefined);
  });

  it('runs a NOWAIT resolve on the client', async () => {
    const { payload } = await drawn('/app/sheet/7B');
    const { router, calls } = makeRouter();
    seed(router, roundTrip(payload));

    const transition = await settle(router, '/app/sheet/7B');

    assert.equal(calls.get('app.sheet.comments'), 1);
    assert.deepEqual(await transition.injector().get('comments'), ['first']);
  });

  it('still fires a real boot transition through a started router', async () => {
    const { payload } = await drawn('/app/sheet/7B');
    const { router, calls } = makeRouter();
    const entered: string[] = [];
    router.transitionService.onEnter({}, (_trans, state) => {
      entered.push(String(state.name));
    });
    seed(router, roundTrip(payload));

    const landed = new Promise<string>((resolve) => {
      router.transitionService.onSuccess({}, (trans) => {
        resolve(trans.$to().name);
      });
    });

    router.urlService.url('/app/sheet/7B');
    router.urlService.listen();
    router.urlService.sync();

    assert.equal(await landed, 'app.sheet');
    assert.deepEqual(entered, ['app', 'app.sheet']);
    assert.equal(calls.get('app.sheet.title'), undefined);
  });

  it('adopts on the redirect target when the payload was drawn there', async () => {
    const { payload } = await drawn('/old/7B');
    const { router, calls } = makeRouter();
    seed(router, roundTrip(payload));

    const transition = await settle(router, '/old/7B');

    assert.equal(transition.to().name, 'app.sheet');
    assert.equal(calls.get('app.sheet.title'), undefined);
  });

  it('runs every resolve of a state outside the drawn set, and disarms after boot', async () => {
    const { payload } = await drawn('/app/sheet/7B');
    const { router, calls } = makeRouter();
    seed(router, roundTrip(payload));
    await settle(router, '/app/sheet/7B');

    await settle(router, '/app/index');
    assert.equal(calls.get('app.index.list'), 1);

    await settle(router, '/app/sheet/7B');
    assert.equal(calls.get('app.sheet.title'), 1);
  });

  it('adopts nothing for a boot to another state', async () => {
    const { payload } = await drawn('/app/sheet/7B');
    const { router, calls } = makeRouter();
    seed(router, roundTrip(payload));

    await settle(router, '/app/index');

    assert.equal(calls.get('app.user'), 1);
    assert.equal(calls.get('app.index.list'), 1);
  });

  it('adopts nothing for a boot to the same state with other params', async () => {
    const { payload } = await drawn('/app/sheet/7B');
    const { router, calls } = makeRouter();
    seed(router, roundTrip(payload));

    const transition = await settle(router, '/app/sheet/8');

    assert.equal(calls.get('app.user'), 1);
    assert.equal(calls.get('app.sheet.title'), 1);
    assert.equal(transition.injector().get('title'), 'Ada: sheet 8');
  });

  it('runs every resolve without a payload, or with a stripped one', async () => {
    for (const payload of [
      undefined,
      { state: 'app.sheet', params: { num: '7B' }, resolves: {} },
    ]) {
      const { router, calls } = makeRouter();
      seed(router, payload);

      await settle(router, '/app/sheet/7B');

      assert.equal(calls.get('app.user'), 1);
      assert.equal(calls.get('app.sheet.title'), 1);
    }
  });

  it('adopts nothing from a payload whose drawn-for members are garbled', async () => {
    const { payload } = await drawn('/app/sheet/7B');

    for (const garbled of [
      { ...payload, state: 7 },
      { ...payload, params: '7B' },
      { ...payload, params: null },
    ]) {
      const { router, calls } = makeRouter();
      seed(router, parse(JSON.stringify(garbled)));

      await settle(router, '/app/sheet/7B');

      assert.equal(total(calls), 7);
    }
  });

  it('throws at once on a payload missing its resolves objects', () => {
    const { router } = makeRouter();
    const before = router.transitionService.getHooks('onBefore').length;

    for (const text of [
      '{"state":"app"}',
      '{"state":"app","params":{},"resolves":{"app":null}}',
    ])
      assert.throws(() => seed(router, parse(text)), TypeError);

    assert.equal(router.transitionService.getHooks('onBefore').length, before);
  });

  it('adopts nothing once disarmed', async () => {
    const { payload } = await drawn('/app/sheet/7B');
    const { router, calls } = makeRouter();
    const disarm = seed(router, roundTrip(payload));
    disarm();

    await settle(router, '/app/sheet/7B');

    assert.equal(calls.get('app.sheet.title'), 1);
  });
});
