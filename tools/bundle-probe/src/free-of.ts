import type { BundleResult } from './bundle.ts';

/**
 * The package a bare specifier belongs to: `lit/directive.js` is `lit`,
 * `@uirouter/core/lib/index.js` is `@uirouter/core`.
 */
export const packageOf = (specifier: string): string => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

/**
 * The external packages an entry reaches through **static** imports: the entry
 * chunk plus every chunk it statically imports, transitively.
 *
 * Why the static graph and not the whole bundle: a dynamic `import()` is the
 * boundary a "free of X" claim is built on, and both bundlers report it the
 * same way — esbuild's metafile edge carries `kind: 'dynamic-import'` and
 * rolldown lists the target under `dynamicImports`, each pointing at a chunk of
 * its own. Walking `staticImports` therefore excludes a lazily-loaded chunk and
 * everything only it imports, which is exactly the claim: nothing is on the
 * module graph a consumer evaluates when it imports the entry.
 *
 * Externals, not inputs: a declared dependency or peer is external to the
 * probe's bundle, so it never appears among the resolved inputs the
 * declared-deps-only check reads. It appears as a bare specifier on the chunk
 * that imports it, which is what this reads.
 */
export const staticExternals = ({ entry, chunks }: BundleResult): string[] => {
  const byName = new Map(chunks.map((chunk) => [chunk.name, chunk]));
  const seen = new Set<string>([entry.name]);
  const queue = [entry];
  const externals = new Set<string>();
  while (queue.length > 0) {
    const chunk = queue.pop()!;
    for (const specifier of chunk.externalImports) externals.add(specifier);
    for (const name of chunk.staticImports) {
      if (seen.has(name)) continue;
      seen.add(name);
      const next = byName.get(name);
      if (next) queue.push(next);
    }
  }
  return [...externals];
};

/**
 * The specifiers that break an entry's `free` claim: every statically reachable
 * external import belonging to one of the named packages.
 */
export const violations = (result: BundleResult, free: string[]): string[] =>
  staticExternals(result).filter((specifier) =>
    free.includes(packageOf(specifier)),
  );
