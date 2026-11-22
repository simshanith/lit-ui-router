import type { ResolveTypes, Transition } from '@uirouter/core';
import type { StatesOf } from 'ui-router-registry';

import { loadPlanet } from './planets';
import { Home, PlanetView } from './views';

// Outside the `as const` table: core's StateDeclaration takes a mutable array.
const planetResolves: ResolveTypes[] = [
  {
    token: 'planet',
    deps: ['$transition$'],
    resolveFn: (transition: Transition) =>
      loadPlanet(transition.params<{ planetId: string }>().planetId),
  },
];

// Declared `as const` so ui-router-registry can read the names and params.
export const states = [
  { name: 'home', url: '/', component: Home },
  {
    name: 'planet',
    url: '/planets/:planetId',
    component: PlanetView,
    resolve: planetResolves,
  },
] as const;

declare module 'ui-router-registry' {
  interface RegisteredStates extends StatesOf<typeof states> {}
}
