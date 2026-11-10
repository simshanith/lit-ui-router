// Where a prerendered page lands under outDir, shared by the loop and the preview server.

/** The mount-relative path: `''` at the mount root, `/sheet/7B` below it. */
export const subpathIn = (mount: string, path: string): string => {
  const base = mount === '/' ? '' : mount.replace(/\/+$/, '');

  return path.startsWith(base)
    ? path.slice(base.length).replace(/\/+$/, '')
    : path;
};

/** `<subpath>/index.html`, or `index.html` at the mount root. */
export const fileFor = (subpath: string): string => {
  const trimmed = subpath.replace(/^\/+/, '').replace(/\/+$/, '');

  return trimmed === '' ? 'index.html' : `${trimmed}/index.html`;
};
