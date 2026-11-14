// Where a prerendered page lands under outDir, shared by the loop and the preview server.

/** The mount-relative path: `''` at the mount root, `/sheet/7B` below it. */
export const subpathIn = (mount: string, path: string): string => {
  const base = mount === '/' ? '' : mount.replace(/\/+$/, '');

  return path.startsWith(base)
    ? path.slice(base.length).replace(/\/+$/, '')
    : path;
};

// One segment as a static host looks it up: decoded, except an escape that would add a separator or a dot segment.
const fileSegment = (segment: string): string => {
  let decoded: string;

  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // A malformed escape names no other spelling.
    return segment;
  }

  if (decoded === '.' || decoded === '..') return segment;

  return decoded.replace(/[/\\\0]/g, encodeURIComponent);
};

/** The path's name on disk: each segment decoded, as a static host decodes the request path before its file lookup. */
export const fileName = (path: string): string =>
  path.split('/').map(fileSegment).join('/');

/** The path as a rules line spells it: whitespace, control and non-ASCII characters percent-encoded, escapes kept. */
export const rulePath = (path: string): string =>
  path.replace(/[^\x21-\x7e]+/g, (run) =>
    encodeURIComponent(run.replace(/\p{Cs}/gu, '\uFFFD')),
  );

/** `<subpath>/index.html` under its {@link fileName}, or `index.html` at the mount root. */
export const fileFor = (subpath: string): string => {
  const trimmed = fileName(subpath.replace(/^\/+/, '').replace(/\/+$/, ''));

  return trimmed === '' ? 'index.html' : `${trimmed}/index.html`;
};
