import { resolveWwwDevPort } from '@www/lit-ui-router.dev/dev-port.ts';

// Where the suites point. E2E_BASE_URL names a site that is already served (a
// deployed preview, say); empty or absent means the local wrangler dev server
// on the WWW_DEV_PORT port. The site links its mounts by absolute path, so the
// override is an origin and nothing more.

/** The origin the suites target, without a trailing slash; `remote` when no local dev server serves it. */
export interface E2eTarget {
  origin: string;
  remote: boolean;
}

export function resolveE2eTarget(
  raw: string | undefined = process.env.E2E_BASE_URL,
): E2eTarget {
  const value = raw?.trim();

  if (!value) {
    return { origin: `http://localhost:${resolveWwwDevPort()}`, remote: false };
  }

  const url = URL.parse(value);

  if (url === null || (url.protocol !== 'http:' && url.protocol !== 'https:'))
    throw new Error(`E2E_BASE_URL is not an absolute http(s) URL: ${value}`);

  if (
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(
      `E2E_BASE_URL must be a bare origin such as https://example.com, not ${value}`,
    );

  return { origin: url.origin, remote: true };
}

/** `path` under the target origin; with or without a leading slash, it resolves from the root. */
export function e2eUrl(path: string, target = resolveE2eTarget()): string {
  return new URL(path, `${target.origin}/`).href;
}
