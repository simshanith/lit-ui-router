// The states as data, with no components: the client adds components and resolves, the server compiles its mount.
import { routesFromStates, type MountConfig } from 'ui-router-server';

export const routes = {
  planets: { name: 'planets', url: '/' },
  planet: { name: 'planet', url: '/planets/:planetId' },
  legacy: { name: 'legacy', url: '/legacy', redirectTo: 'planets' },
  notFound: { name: 'notFound' },
} as const;

export const mount = {
  routes: routesFromStates(Object.values(routes)),
  otherwise: { state: routes.notFound.name },
  config: { strict: false },
} satisfies MountConfig;

export const mounts = { '/': mount };
