const PREFIX = '/main';

/** The unreleased docs' alias, bare and with its subpaths. */
export const isMainAliasPath = (pathname: string): boolean =>
  pathname === PREFIX || pathname.startsWith(`${PREFIX}/`);

/** Sends an alias URL to the same path at the root, query kept; temporary, since the alias is not a moved page. */
export function redirectMainAlias(url: URL): Response {
  // One leading slash: `//host` in a Location names another origin.
  const path = url.pathname.slice(PREFIX.length).replace(/^\/+/, '/') || '/';

  return new Response(null, {
    status: 302,
    headers: { Location: `${path}${url.search}` },
  });
}
