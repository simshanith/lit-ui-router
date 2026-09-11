// Terminal process handover, and the bin lookup that feeds it. The opposite
// contract to ./exec.ts: nothing here returns, and nothing here is injectable.
//
// A launcher that spawns has to re-plumb signals by hand and still loses the
// race — a SIGTERM to the launcher leaves the child holding its port. Replacing
// the process image removes the child, so the command's exit code and signals
// are the launcher's with no plumbing at all.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The fields of a dependency's manifest that name its executables. */
export interface BinManifest {
  name: string;
  bin?: string | Record<string, string>;
}

/**
 * A dependency's bin, resolved through its own manifest rather than PATH.
 *
 * The caller supplies both halves statically:
 *
 * ```ts
 * import pkg from 'wrangler/package.json' with { type: 'json' };
 * const BIN = binPath(pkg, import.meta.resolve('wrangler/package.json'));
 * ```
 *
 * The literal specifier stays at the call site on purpose. A `binPath(spec)`
 * taking the package name as a parameter would be tidier to read and worse in
 * two ways: it would resolve against THIS package's node_modules rather than
 * the caller's, which pnpm's isolated layout makes wrong; and it would hide the
 * dependency from knip, which follows static imports but not a string argument.
 * That visibility is why apps/sample-app-lit-e2e carries no `ignoreDependencies`
 * entry for start-server-and-test.
 *
 * Only `./package.json` goes through the dependency's `exports` map; the bin is
 * joined onto that directory afterwards. Resolving the bin as a subpath instead
 * would need the map to publish it too, and hardly any package does —
 * typescript, oxlint and oxfmt all export `./package.json` and none of them
 * export their bin.
 */
export function binPath(
  manifest: BinManifest,
  manifestUrl: string,
  bin: string = manifest.name,
): string {
  // the one-bin shorthand names itself after the package
  const path =
    typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[bin];
  if (path === undefined) {
    throw new Error(`${manifest.name} declares no ${bin} bin`);
  }
  // join normalizes, so the `./bin/x` and `bin/x` spellings both land
  return join(dirname(fileURLToPath(manifestUrl)), path);
}

// POSIX-only, hence optional in @types/node. Bound once so the annotation below
// has something total to describe.
const handover = process.execve;

/**
 * Become `file`. Does not return.
 *
 * `args` includes argv[0], which is the caller's to set; env defaults to
 * `process.env`. `label` names the launcher in the unsupported-platform error,
 * which is the only way this call ever comes back.
 *
 * Annotated rather than inferred: a call only narrows past an explicitly typed
 * declaration, which is what lets callers treat it as terminal.
 */
export const execve: (
  label: string,
  file: string,
  args: readonly string[],
) => never = handover
  ? (_label, file, args) => handover(file, [...args])
  : (label) => {
      throw new Error(`${label}: process.execve is unavailable (POSIX only)`);
    };
