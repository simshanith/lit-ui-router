// Catalog range + installed alias version, the two halves every compat guard
// compares. The catalog comes from the pnpm SDK (see @tools/shared/workspace.ts
// for why never hand-parsed YAML); the alias is read from the invoking
// package's node_modules, so guards run from the package dir.
import { join } from 'node:path';

import { readManifest } from '@tools/shared/manifest.ts';
import type { PackageManifest } from '@tools/shared/types.ts';
import {
  selectCatalogs,
  loadWorkspaceManifest,
  workspaceRoot,
} from '@tools/shared/workspace.ts';

/** A dependency's range in a named catalog; undefined when either is absent. */
export async function catalogRange(
  catalog: string,
  dep: string,
): Promise<string | undefined> {
  const catalogs = await selectCatalogs(loadWorkspaceManifest(workspaceRoot));
  return catalogs[catalog]?.[dep];
}

/**
 * Manifest of an aliased devDep as installed in the invoking package; undefined
 * when the alias isn't installed there. See @tools/shared/manifest.ts for why
 * the manifest is read rather than resolved.
 */
export function installedManifest(alias: string): PackageManifest | undefined {
  return readManifest(join(process.cwd(), 'node_modules', alias));
}
