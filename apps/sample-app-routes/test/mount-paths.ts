// Probe paths and both-ways mount tables, shared by the trie differential test and the bench.
import type {
  MountConfig,
  RouteDeclaration,
  RouteIndex,
} from 'ui-router-server';

/** Each url-bearing state's full url, nested urls appended, in declaration order. */
export const routeUrls = (routes: readonly RouteDeclaration[]): string[] => {
  const urlOf = new Map<string, string>();

  for (const route of routes) {
    if (route.url === undefined) continue;

    const parent = route.name.substring(0, route.name.lastIndexOf('.'));
    urlOf.set(route.name, `${urlOf.get(parent) ?? ''}${route.url}`);
  }

  return [...urlOf.values()];
};

/** A url with every `:param` filled by `sample`. */
export const filled = (url: string, sample: string): string =>
  url.replaceAll(/:\w+/g, sample);

const SAMPLES = ['42', 'inbox', 'a.b-c~d'];

// Near misses around a real url: case, extra or missing characters, doubled slashes.
const nearMisses = (url: string): string[] => [
  `${url}/`,
  `${url}x`,
  `${url}/x`,
  `${url}//`,
  url.toUpperCase(),
  url.slice(0, -1),
  url.replace('/', '//'),
];

// Bare and trailing-slash bases, then paths no table declares.
const BASE_FORMS = ['', '/', '//'];

const UNKNOWN = ['/nope', '/nope/deeper', '/%2F', '/welcome%2Fx', '/.', '/..'];

/** Every path the differential test resolves under `base`: hits, near misses, base forms, unknowns. */
export const probePaths = (base: string, config: MountConfig): string[] => {
  const hits = routeUrls(config.routes).flatMap((url) =>
    SAMPLES.map((sample) => filled(url, sample)),
  );

  const paths = new Set([
    ...hits,
    ...hits.flatMap(nearMisses),
    ...BASE_FORMS,
    ...UNKNOWN,
  ]);

  return [...paths].map((path) => `${base}${path}`);
};

/** The table with every 'matcher' mount on `routeIndex`; undefined is the linear default. */
export const withRouteIndex = (
  mounts: Record<string, MountConfig>,
  routeIndex: RouteIndex | undefined,
): Record<string, MountConfig> =>
  Object.fromEntries(
    Object.entries(mounts).map(([base, config]) => [
      base,
      config.strategy === 'simulate' ? config : { ...config, routeIndex },
    ]),
  );
