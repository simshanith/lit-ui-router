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

/** A host-absolute path under the base; a url or a relative path stays as written. */
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
