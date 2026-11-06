// The server-side route table: data only, the same names and urls as the client states.
import type { MountConfig } from 'ui-router-server';

export const mounts = {
  '/': {
    routes: [
      { name: 'planets', url: '/planets' },
      { name: 'planet', url: '/planets/:planetId' },
      { name: 'legacy', url: '/legacy', redirectTo: 'planets' },
      { name: 'notFound' },
    ],
    redirects: [{ pattern: /^\/?$/, to: 'planets' }],
    otherwise: { state: 'notFound' },
    config: { strict: false },
  },
} satisfies Record<string, MountConfig>;

export const paths = [
  '/',
  '/planets',
  ...Array.from({ length: 10 }, (_, i) => `/planets/${i + 1}`),
  '/legacy',
  '/nowhere',
];
