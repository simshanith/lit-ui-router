// Vite's `base`: a prefix the host adds in front of the site, which the route table never sees.

/**
 * The base with one trailing slash, `/` when `undefined`.
 *
 * @throws an `Error` for a relative base (`./`, `''`) or a full-URL base
 */
export const normalizeBase = (
  base: string | undefined,
  caller: string,
): string => {
  if (base === undefined) return '/';

  if (/^([a-z][a-z\d+.-]*:)?\/\//i.test(base))
    throw new Error(
      `${caller}: base '${base}' is a full URL; only a path base such as '/app/' is supported`,
    );

  if (!base.startsWith('/'))
    throw new Error(
      `${caller}: base '${base}' is relative, which breaks the asset links of pages in nested folders; pass an absolute path such as '/app/'`,
    );

  return base.endsWith('/') ? base : `${base}/`;
};

/**
 * A host-absolute path as a host serving the site under `base` spells it:
 * `withBase('/solar/', '/contacts')` is `/solar/contacts`.
 *
 * `base` is a path base with its trailing slash, the form `prerender()` hands
 * a rules writer and a server router reports as `router.base`; a base without
 * the slash loses its last character. Under `/` the path stays as written,
 * as does anything that is not a host-absolute path: a full url
 * (`https://example.test/x`), a protocol-relative one (`//example.test/x`)
 * and a relative path (`x`, `./x`, `?q=1`). The path is never inspected for
 * the base, so one that already carries it gets it twice.
 */
export const withBase = (base: string, path: string): string =>
  base === '/' || !path.startsWith('/') || path.startsWith('//')
    ? path
    : `${base.slice(0, -1)}${path}`;

/** The url with the base taken off, or `undefined` when it lies outside the base. */
export const stripBase = (base: string, url: string): string | undefined => {
  if (base === '/') return url;
  const root = base.slice(0, -1);
  const cut = url.search(/[?#]/);
  const pathname = cut === -1 ? url : url.slice(0, cut);

  if (pathname === root) return `/${url.slice(root.length)}`;

  return pathname.startsWith(base) ? url.slice(root.length) : undefined;
};

/** Whether a mount key already spells the base: `/app` or `/app/x` under `/app/`. */
export const carriesBase = (base: string, mount: string): boolean =>
  base !== '/' && `${mount.replace(/\/+$/, '')}/`.startsWith(base);

/**
 * The mount table with the base taken off each key, for a table keyed by
 * the base.
 *
 * @throws an `Error` for a key outside the base
 */
export const mountsUnder = <T>(
  base: string,
  mounts: Record<string, T>,
  caller: string,
): Record<string, T> => {
  if (base === '/') return mounts;

  return Object.fromEntries(
    Object.entries(mounts).map(([key, mount]) => {
      if (!carriesBase(base, key))
        throw new Error(
          `${caller}: mount '${key}' lies outside base '${base}'`,
        );

      return [key.startsWith(base) ? `/${key.slice(base.length)}` : '/', mount];
    }),
  );
};

/**
 * An adapter's base: its own option, else the router's.
 *
 * @throws an `Error` when both are set and differ, or the base is relative or a full URL
 */
export const baseFor = (
  router: { readonly base?: string },
  base: string | undefined,
  caller: string,
): string => {
  const declared = router.base;
  const normalized = normalizeBase(base ?? declared, caller);

  if (declared !== undefined && normalized !== declared)
    throw new Error(
      `${caller}: base '${normalized}' differs from the router's base '${declared}'`,
    );

  return normalized;
};

/**
 * Resolves the base against a router that declares none, to catch a mount
 * table keyed by the base, which would otherwise see the base twice.
 *
 * @throws an `Error` naming `createServerRouter({ base, mounts })` when the base's mount already carries it
 */
export const checkUndeclaredBase = async (
  router: {
    readonly base?: string;
    resolve(path: string): Promise<{ mount?: string }>;
  },
  base: string,
  caller: string,
): Promise<void> => {
  if (base === '/' || router.base !== undefined) return;
  const { mount } = await router.resolve(base);

  if (mount !== undefined && carriesBase(base, mount))
    throw new Error(
      `${caller}: mount '${mount}' already carries base '${base}': declare createServerRouter({ base: '${base}', mounts }), or key the mount '/'`,
    );
};
