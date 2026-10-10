/** Keeps every page outside `/api/` and the first page of each `/api/` directory. */
export function samplePages(paths: readonly string[]): string[] {
  const seen = new Set<string>();

  return [...paths].sort().filter((path) => {
    if (!path.startsWith('/api/')) return true;

    const directory = path.slice(0, path.lastIndexOf('/'));

    if (seen.has(directory)) return false;

    seen.add(directory);

    return true;
  });
}
