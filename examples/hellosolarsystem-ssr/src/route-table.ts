// The server's route table: data only, the same names and urls as the client's states.
import type { MountConfig } from 'ui-router-server';

export const mounts = {
  '/': {
    routes: [
      { name: 'planets', url: '/' },
      { name: 'planet', url: '/planets/:planetId' },
      { name: 'legacy', url: '/legacy', redirectTo: 'planets' },
      { name: 'notFound' },
    ],
    otherwise: { state: 'notFound' },
    config: { strict: false },
  },
} satisfies Record<string, MountConfig>;

/** Every path to emit; the 404 page comes from `otherwise` without being listed. */
export const paths = [
  '/',
  ...Array.from({ length: 10 }, (_, i) => `/planets/${i + 1}`),
  '/legacy',
];
