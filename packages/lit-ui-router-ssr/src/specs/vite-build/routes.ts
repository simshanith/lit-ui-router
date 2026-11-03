import type { MountConfig } from 'ui-router-server';

export const mounts = {
  '/': {
    routes: [
      { name: 'home', url: '/' },
      { name: 'about', url: '/about' },
      { name: 'legacy', url: '/legacy', redirectTo: 'about' },
      { name: 'notFound' },
    ],
    otherwise: { state: 'notFound' },
    config: { strict: false },
  },
} satisfies Record<string, MountConfig>;

export const paths = ['/', '/about', '/legacy'];
