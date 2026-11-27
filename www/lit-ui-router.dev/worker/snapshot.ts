// Node-free: the docs worker serves the snapshots from it, and the bake and the publish script read its table.
import { ISOLATION_HEADERS } from '../catalog/security-headers.ts';
import { SURFACES } from '../catalog/surfaces.ts';
import manifest from '../public/versions.json' with { type: 'json' };

/** A docs line served from the snapshot bucket, under the paths it owns. */
export interface SnapshotLine {
  /** `v1` for a site-wide line, `<package>/v0` for a package's. */
  id: string;
  /** URL prefixes the line owns, each ending in `/`; the bare prefix without its slash is the line's too. */
  roots: readonly string[];
  /** A site-wide line is a whole-site build under its base: it carries the `Link` rule and the mount redirects. */
  site: boolean;
}

/** The slice of `/versions.json` that names the lines; the full schema is `VersionManifest` in `.vitepress/versions.ts`. */
export interface LineManifest {
  others: readonly { id: string; path: string }[];
  packages?: Readonly<Record<string, readonly { id: string }[]>>;
}

/** Every line the manifest lists: a site-wide version at its path, a package line at its page and its reference. */
export const snapshotLines = (lines: LineManifest): SnapshotLine[] => [
  ...lines.others.map(({ id, path }) => ({ id, roots: [path], site: true })),
  ...Object.entries(lines.packages ?? {}).flatMap(([name, listed]) =>
    listed.map(({ id }) => ({
      id: `${name}/${id}`,
      roots: [`/packages/${name}/${id}/`, `/reference/${name}/${id}/`],
      site: false,
    })),
  ),
];

/** The lines this build serves, from the manifest bundled with it. */
export const SNAPSHOT_LINES: readonly SnapshotLine[] = snapshotLines(manifest);

/** A snapshot surface's row: a line's prefix, served from the bucket. */
export const isSnapshotRow = (id: string): boolean =>
  id.startsWith('snapshot-');

/** The worker's mounts: a snapshot serves none of them, so its links into them go to the main site's. */
export const WORKER_MOUNTS: readonly string[] = SURFACES.flatMap(
  ({ id, renderer, paths }) =>
    renderer === 'worker' && !isSnapshotRow(id)
      ? paths.filter((path) => !path.includes('*'))
      : [],
);

/** A line and the root of it that holds a path. */
export interface LinePlace {
  line: SnapshotLine;
  root: string;
}

/** The line root that owns a path, bare root included; the longest wins. */
export function lineAt(
  pathname: string,
  lines: readonly SnapshotLine[] = SNAPSHOT_LINES,
): LinePlace | undefined {
  let found: LinePlace | undefined;

  for (const line of lines) {
    for (const root of line.roots) {
      const owns = pathname.startsWith(root) || `${pathname}/` === root;

      if (owns && root.length > (found?.root.length ?? 0))
        found = { line, root };
    }
  }

  return found;
}

/** Whether a path belongs to a line the bucket serves. */
export const isSnapshotPath = (pathname: string): boolean =>
  lineAt(pathname) !== undefined;

/** The object key a URL path is stored under: the bucket mirrors the URL space, decoded, without the leading slash. */
export function objectKey(pathname: string): string {
  try {
    return decodeURI(pathname.slice(1));
  } catch {
    return pathname.slice(1);
  }
}

/** The main site's `Link` rule moved under a site-wide line's base, as the bake moves `public/_headers`. */
export const siteLineLink = (root: string): string =>
  `<${root}llms.txt>; rel="describedby", <${root}introduction>; rel="service-doc"`;

/** Cache-Control for a line's hashed build assets, as `public/_headers` sets it for `/assets/*`. */
export const IMMUTABLE = 'public, max-age=31536000, immutable';

/** Cache-Control for everything else, the assets binding's default. */
export const REVALIDATE = 'public, max-age=0, must-revalidate';

/** The assets binding's content types for what a docs build holds, by extension; anything else goes without one, as the binding sends it. */
export const CONTENT_TYPES: ReadonlyMap<string, string> = new Map([
  ['css', 'text/css'],
  ['gif', 'image/gif'],
  ['html', 'text/html'],
  ['ico', 'image/vnd.microsoft.icon'],
  ['jpg', 'image/jpeg'],
  ['js', 'text/javascript'],
  ['json', 'application/json'],
  ['md', 'text/markdown'],
  ['mjs', 'text/javascript'],
  ['png', 'image/png'],
  ['svg', 'image/svg+xml'],
  ['txt', 'text/plain'],
  ['webp', 'image/webp'],
  ['woff', 'font/woff'],
  ['woff2', 'font/woff2'],
  ['xml', 'application/xml'],
]);

/** A key's content type, by its extension. */
export function contentTypeOf(key: string): string | undefined {
  const name = key.slice(key.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');

  return dot > 0 ? CONTENT_TYPES.get(name.slice(dot + 1)) : undefined;
}

/** One step of `auto-trailing-slash` HTML handling: if `key` exists, serve it, or redirect to `redirect` when set. */
export interface Candidate {
  key: string;
  redirect?: string;
}

/** The steps `auto-trailing-slash` HTML handling tries for a path, in order; the first whose key exists decides. */
export function candidates(pathname: string): Candidate[] {
  const key = objectKey(pathname);

  if (pathname.endsWith('/'))
    return [
      { key: `${key}index.html` },
      { key: `${key.slice(0, -1)}.html`, redirect: pathname.slice(0, -1) },
    ];

  const index = /\/index(?:\.html)?$/.exec(pathname);

  if (index) {
    const dir = pathname.slice(0, index.index + 1);

    return [{ key: `${objectKey(dir)}index.html`, redirect: dir }];
  }

  if (pathname.endsWith('.html')) {
    const bare = pathname.slice(0, -'.html'.length);

    return [
      { key, redirect: bare },
      { key: `${objectKey(bare)}/index.html`, redirect: `${bare}/` },
    ];
  }

  return [
    { key },
    { key: `${key}.html` },
    { key: `${key}/index.html`, redirect: `${pathname}/` },
  ];
}

/** The 404 pages a miss tries, nearest first, up to the line's root, as `404-page` handling walks up. */
export function notFoundKeys(pathname: string, root: string): string[] {
  const keys: string[] = [];
  let dir = pathname.slice(0, pathname.lastIndexOf('/') + 1);

  if (!dir.startsWith(root)) dir = root;

  while (dir.length >= root.length) {
    keys.push(`${objectKey(dir)}404.html`);
    dir = dir.slice(0, dir.lastIndexOf('/', dir.length - 2) + 1);
  }

  return keys;
}

/** The unversioned mount a site-wide line's path points into, if any: its client renders some nav links with its base. */
export function mountTarget(
  pathname: string,
  root: string,
): string | undefined {
  const inner = `/${pathname.slice(root.length)}`;

  return WORKER_MOUNTS.some(
    (mount) => inner === mount || inner.startsWith(`${mount}/`),
  )
    ? inner
    : undefined;
}

/** The headers every response under a line carries, before the object's own. */
function lineHeaders({ line, root }: LinePlace, pathname: string): Headers {
  const headers = new Headers(ISOLATION_HEADERS);

  if (
    line.site &&
    pathname.startsWith(root) &&
    !pathname.startsWith(`${root}assets/`)
  )
    headers.set('Link', siteLineLink(root));

  return headers;
}

/** The members of an R2 object the route reads; structural, so the bake can import this module without the workers types. */
export interface StoredObject {
  httpEtag: string;
}

/** The R2 bucket reads the route makes: a bodiless object from `get` means its `onlyIf` precondition failed. */
export interface SnapshotBucket {
  head: (key: string) => Promise<StoredObject | null>;
  get: (
    key: string,
    options?: { onlyIf: Headers },
  ) => Promise<StoredObject | (StoredObject & { body: ReadableStream }) | null>;
}

const unavailable = (): Response =>
  new Response('These docs are unavailable right now.\n', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

const redirect = (
  location: string,
  status: 301 | 307,
  headers: Headers,
): Response => {
  headers.set('Location', location);

  return new Response(null, { status, headers });
};

/** An object read for a request, with its body unless the request was a HEAD or its precondition held. */
interface Found {
  object: StoredObject;
  body: ReadableStream | null;
}

/** A stored object as a response: its content type by extension, its ETag, and the line's cache rule. */
function objectResponse(
  { object, body }: Found,
  status: number,
  key: string,
  place: LinePlace,
  headers: Headers,
): Response {
  // By extension only: an upload stores application/octet-stream on a key the binding sends untyped.
  const type = contentTypeOf(key);

  if (type) headers.set('Content-Type', type);
  headers.set('ETag', object.httpEtag);
  headers.set(
    'Cache-Control',
    status !== 404 && key.startsWith(`${objectKey(place.root)}assets/`)
      ? IMMUTABLE
      : REVALIDATE,
  );

  return new Response(body, { status, headers });
}

/**
 * Reads a key for the request: a HEAD reads only metadata, and a GET with `conditional` set
 * answers 304 when the request's precondition holds. Null when the key is absent.
 */
async function read(
  bucket: SnapshotBucket,
  key: string,
  request: Request,
  conditional: boolean,
): Promise<Found | null> {
  if (request.method === 'HEAD') {
    const object = await bucket.head(key);

    return object && { object, body: null };
  }

  const object = await bucket.get(
    key,
    conditional ? { onlyIf: request.headers } : undefined,
  );

  if (!object) return null;

  return { object, body: 'body' in object ? object.body : null };
}

/** The bucket's answer for a path: the first candidate that exists, else the nearest 404 page. */
async function fromBucket(
  request: Request,
  url: URL,
  bucket: SnapshotBucket,
  place: LinePlace,
  headers: Headers,
): Promise<Response> {
  for (const { key, redirect: location } of candidates(url.pathname)) {
    if (location !== undefined) {
      if (await bucket.head(key))
        return redirect(`${location}${url.search}`, 307, headers);

      continue;
    }

    const found = await read(bucket, key, request, true);
    const notModified = request.method === 'GET' && found?.body === null;

    if (found)
      return objectResponse(
        found,
        notModified ? 304 : 200,
        key,
        place,
        headers,
      );
  }

  for (const key of notFoundKeys(url.pathname, place.root)) {
    const found = await read(bucket, key, request, false);

    if (found) return objectResponse(found, 404, key, place, headers);
  }

  headers.set('Content-Type', 'text/plain; charset=utf-8');

  return new Response('Not found\n', { status: 404, headers });
}

/**
 * Serves a line's path from the bucket the way the assets binding served the snapshot Worker:
 * `auto-trailing-slash` HTML handling, the nearest `404.html` at 404, and for a site-wide line the
 * moved `_headers` and the redirects into the worker's mounts. A missing bucket or a failed read is
 * a plain 503, never a main-site page.
 */
export async function serveSnapshot(
  request: Request,
  bucket: SnapshotBucket | undefined,
  lines: readonly SnapshotLine[] = SNAPSHOT_LINES,
): Promise<Response> {
  const url = new URL(request.url);
  const place = lineAt(url.pathname, lines);

  if (!place || !bucket) return unavailable();

  const headers = lineHeaders(place, url.pathname);

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    headers.set('Allow', 'GET, HEAD');

    return new Response(null, { status: 405, headers });
  }

  const mount = place.line.site
    ? mountTarget(url.pathname, place.root)
    : undefined;

  if (mount !== undefined)
    return redirect(`${mount}${url.search}`, 301, headers);

  try {
    return await fromBucket(request, url, bucket, place, headers);
  } catch {
    return unavailable();
  }
}
