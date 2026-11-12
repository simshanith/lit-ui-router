import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UIRouter } from '@uirouter/core';
import type { StateDeclaration, StateRule } from '@uirouter/core';

import { createServerRouter, routesFromStates } from '../src/index.ts';
import type {
  ResponseState,
  RouteDeclaration,
  ServerRouterDeclarations,
} from '../src/index.ts';

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

class Profile {}

// The shared module: data only, the client spreads it into its states.
const states = [
  { name: 'home', url: '/', data: { title: 'Home' } },
  {
    name: 'item',
    url: '/items/:id',
    params: { id: { type: 'int' } },
    dynamic: true,
  },
  { name: 'legacy', url: '/old', redirectTo: 'home' },
  { name: 'badge', url: '/badge.svg', response: true },
  { name: 'admin', abstract: true },
  { name: 'admin.users', url: '/admin/users' },
  { name: 'notFound' },
] as const satisfies readonly StateDeclaration[];

const mounted = (strategy: 'matcher' | 'simulate') =>
  createServerRouter({
    mounts: {
      '/': {
        routes: routesFromStates(states),
        otherwise: { state: 'notFound' },
        config: { strict: false },
        strategy,
      },
    },
  });

describe('routesFromStates', () => {
  it('keeps the routing fields in order and drops the rest', () => {
    assert.deepEqual(routesFromStates(states), [
      { name: 'home', url: '/' },
      { name: 'item', url: '/items/:id', params: { id: { type: 'int' } } },
      { name: 'legacy', url: '/old', redirectTo: 'home' },
      { name: 'badge', url: '/badge.svg', response: true },
      { name: 'admin' },
      { name: 'admin.users', url: '/admin/users' },
      { name: 'notFound' },
    ]);
  });

  it('carries every RouteDeclaration field', () => {
    const route = {
      name: 'moved',
      parent: 'root',
      url: '/moved/{id}',
      params: { id: 1 },
      redirectTo: { state: 'home', params: { tab: 'a' } },
      redirectStatusCode: 308,
      delegate: 'api',
      response: true,
    } as const satisfies Required<RouteDeclaration>;

    assert.deepEqual(routesFromStates([route]), [route]);
  });

  for (const strategy of ['matcher', 'simulate'] as const)
    it(`serves the shared states on a ${strategy} mount`, async () => {
      const router = mounted(strategy);

      assert.deepEqual(await router.resolve('/items/3'), {
        kind: 'shell',
        mount: '/',
      });
      assert.deepEqual(await router.resolve('/old'), {
        kind: 'redirect',
        mount: '/',
        location: '/',
        status: 302,
      });
      assert.equal((await router.resolve('/badge.svg')).kind, 'response');
      assert.deepEqual(await router.resolve('/nope'), {
        kind: 'shell',
        mount: '/',
        status: 404,
      });
    });

  it('matches the urls core registers from the same states', () => {
    const router = new UIRouter();

    for (const state of states) router.stateRegistry.register({ ...state });

    const served = routesFromStates(states)
      .filter((route) => 'url' in route)
      .map((route) => route.name);

    // SAFETY: registering states adds only state rules.
    const registered = router.urlService.rules
      .rules()
      .map((rule) => (rule as StateRule).state.name);

    assert.deepEqual([...served].sort(), [...registered].sort());
    router.dispose();
  });

  it('rejects a redirectTo only the client can run', () => {
    const fn = { name: 'a', url: '/a', redirectTo: () => 'home' };
    const instance = { name: 'b', url: '/b', redirectTo: new Profile() };

    for (const state of [fn, instance])
      // SAFETY: a JS caller or a widened type reaches the runtime check.
      assert.throws(
        () => routesFromStates([state] as never),
        /only a state name or \{ state, params \} redirectTo can be served/,
      );
  });

  it('rejects an abstract state with a url, which core never matches', () => {
    const state = { name: 'shell', url: '/app', abstract: true } as const;

    assert.throws(
      () => routesFromStates([state]),
      /State 'shell': an abstract state with a url can't be served/,
    );
  });

  it('rejects a nameless state', () => {
    // SAFETY: a JS caller or a widened type reaches the runtime check.
    assert.throws(
      () => routesFromStates([{ url: '/' }] as never),
      /needs a name/,
    );
  });
});

// Type-level: literals carry into the router; client-only fields stay out.
type Decls = ServerRouterDeclarations<ReturnType<typeof mounted>>;

export const responseStates: Equal<ResponseState<Decls>, 'badge'> = true;

export const names: Equal<
  Decls['name'],
  'home' | 'item' | 'legacy' | 'badge' | 'admin' | 'admin.users' | 'notFound'
> = true;

export const dropsData: Equal<
  'data' extends keyof ReturnType<typeof routesFromStates<typeof states>>[0]
    ? true
    : false,
  false
> = true;

export const rejectsFunctionRedirect = () =>
  routesFromStates([
    // @ts-expect-error a function redirectTo needs the client router
    { name: 'a', url: '/a', redirectTo: () => 'home' },
  ]);
