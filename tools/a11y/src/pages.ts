/** The API reference page's layout: index pages by depth, leaf pages by their directory's name. */
function pageKind(path: string): string {
  const segments = path.split('/');

  return path.endsWith('/')
    ? `index:${segments.length}`
    : (segments.at(-2) ?? '');
}

/** Keeps every page outside `/api/` and the first `/api/` page of each kind. */
export function samplePages(paths: readonly string[]): string[] {
  const seen = new Set<string>();

  return [...paths].sort().filter((path) => {
    if (!path.startsWith('/api/')) return true;

    const kind = pageKind(path);

    if (seen.has(kind)) return false;

    seen.add(kind);

    return true;
  });
}
