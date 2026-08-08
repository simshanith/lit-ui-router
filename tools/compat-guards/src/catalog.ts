// Catalog range + installed alias version, the two halves every compat guard
// compares. The catalog comes from the pnpm SDK (see @tools/shared/workspace.ts
// for why never hand-parsed YAML); the alias is read from the invoking
// package's node_modules, so guards run from the package dir.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { loadCatalogs, workspaceRoot } from '@tools/shared/workspace.ts';

/** A dependency's range in a named catalog; throws when either is absent. */
export async function catalogRange(
  guard: string,
  catalog: string,
  dep: string,
): Promise<string> {
  const catalogs = await loadCatalogs(workspaceRoot);
  const range = catalogs[catalog]?.[dep];
  if (!range) {
    throw new Error(
      `${guard}: no ${catalog} ${dep} range in pnpm-workspace.yaml`,
    );
  }
  return range;
}

/** Version of an aliased devDep as installed in the invoking package. */
export function installedVersion(alias: string): string {
  const manifest = JSON.parse(
    readFileSync(
      join(process.cwd(), 'node_modules', alias, 'package.json'),
      'utf8',
    ),
  ) as { version: string };
  return manifest.version;
}
