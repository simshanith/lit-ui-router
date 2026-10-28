import type { MountConfig, RouteDeclaration } from '../src/index.ts';

export const SIZES = [10, 100, 500] as const;

export const MOUNT = '/app';

// Cycles static, param, inline-regexp and squashed-optional segments.
const routeAt = (i: number): RouteDeclaration => {
  switch (i % 4) {
    case 0:
      return { name: `static${i}`, url: `/static-${i}` };
    case 1:
      return { name: `param${i}`, url: `/param-${i}/:id` };
    case 2:
      return { name: `regexp${i}`, url: `/regexp-${i}/{id:[0-9]+}` };
    default:
      return {
        name: `squash${i}`,
        url: `/squash-${i}/:section`,
        params: { section: { value: 'intro', squash: true } },
      };
  }
};

// `size` routes in all: the generated mix plus one redirectTo state.
export const mountConfig = (
  size: number,
  strategy: MountConfig['strategy'],
): MountConfig => ({
  strategy,
  routes: [
    ...Array.from({ length: size - 1 }, (_, i) => routeAt(i)),
    { name: 'legacy', url: '/legacy', redirectTo: 'static0' },
  ],
  redirects: [{ pattern: '/old/:id', to: 'param1' }],
});

// The last route of each kind, so a linear scan pays for the whole table.
export const hitPaths = (size: number): string[] => {
  const last = (kind: number) => size - 2 - ((size - 2 - kind + 4) % 4);

  return [
    `${MOUNT}/static-${last(0)}`,
    `${MOUNT}/param-${last(1)}/abc`,
    `${MOUNT}/regexp-${last(2)}/42`,
    `${MOUNT}/squash-${last(3)}`,
  ];
};

export const MISS = `${MOUNT}/no/such/route`;

// A redirectTo state, then a when()-rule.
export const REDIRECTS = [`${MOUNT}/legacy`, `${MOUNT}/old/7`];

export const config = (size: number, strategy: MountConfig['strategy']) => ({
  mounts: { [MOUNT]: mountConfig(size, strategy) },
});
