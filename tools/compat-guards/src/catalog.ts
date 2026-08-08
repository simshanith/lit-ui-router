// Catalog range + installed alias version, the two halves every compat guard
// compares. The catalog comes from the pnpm SDK (see @tools/shared/workspace.ts
// for why never hand-parsed YAML); the alias is read from the invoking
// package's node_modules, so guards run from the package dir.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { PackageManifest } from '@tools/shared/types.ts';
import { loadCatalogs, workspaceRoot } from '@tools/shared/workspace.ts';

/** A dependency's range in a named catalog; undefined when either is absent. */
export async function catalogRange(
  catalog: string,
  dep: string,
): Promise<string | undefined> {
  const catalogs = await loadCatalogs(workspaceRoot);
  return catalogs[catalog]?.[dep];
}

/**
 * Version of an aliased devDep as installed in the invoking package; undefined
 * when the alias isn't installed there.
 *
 * Read rather than imported: the path is only known at runtime (cwd + alias),
 * so no static import can name it, and `createRequire(import.meta.url)` — the
 * repo's other resolver — anchors on this package, not the caller. The reader
 * libraries the repo already has are each off-label here: pnpm's
 * readProjectManifest is the read-modify-write half of pack-staged, and pacote
 * is a registry client. Local manifests are read this way repo-wide.
 */
export function installedVersion(alias: string): string | undefined {
  const manifest = join(process.cwd(), 'node_modules', alias, 'package.json');
  let source: string;
  try {
    source = readFileSync(manifest, 'utf8');
  } catch {
    return undefined;
  }
  return (JSON.parse(source) as PackageManifest).version;
}
