import type { StateDeclaration, Transition } from '@uirouter/core';

interface Star {
  id: string;
  name: string;
}

const stars: Star[] = [
  { id: 'sun', name: 'Sun' },
  { id: 'proxima-centauri', name: 'Proxima Centauri' },
  { id: 'sirius', name: 'Sirius' },
  { id: 'vega', name: 'Vega' },
  { id: 'arcturus', name: 'Arcturus' },
  { id: 'betelgeuse', name: 'Betelgeuse' },
];

export const delay = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// The examples/hellogalaxy tree, with stub resolves; blackhole and admin.** are demo-only.
export const demoStates = (): StateDeclaration[] => [
  { name: 'galaxy', url: '/galaxy', redirectTo: 'galaxy.stars' },
  {
    name: 'galaxy.stars',
    url: '/stars',
    resolve: [{ token: 'stars', resolveFn: () => delay(180, stars) }],
  },
  {
    name: 'galaxy.stars.star',
    url: '/:starId',
    resolve: [
      {
        token: 'star',
        deps: ['$transition$', 'stars'],
        resolveFn: (trans: Transition, list: Star[]) =>
          delay(
            40,
            list.find((s) => s.id === trans.params().starId),
          ),
      },
    ],
  },
  {
    name: 'galaxy.astronaut',
    url: '/astronaut',
    resolve: [{ token: 'modelViewer', resolveFn: () => delay(200, {}) }],
  },
  {
    name: 'galaxy.blackhole',
    url: '/blackhole',
    resolve: [
      {
        token: 'horizon',
        resolveFn: () =>
          delay(90, null).then(() => {
            throw new Error('Resolve "horizon" rejected: no data escapes');
          }),
      },
    ],
  },
  {
    name: 'admin.**',
    url: '/admin',
    lazyLoad: () =>
      delay(120, {
        states: [
          { name: 'admin', url: '/admin', redirectTo: 'admin.users' },
          {
            name: 'admin.users',
            url: '/users',
            resolve: [{ token: 'users', resolveFn: () => delay(60, []) }],
          },
        ],
      }),
  },
];
