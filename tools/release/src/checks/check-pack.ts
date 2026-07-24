#!/usr/bin/env node
// Guard publishable packages against shipping unsubstituted catalog:/workspace:
// refs. `pnpm pack` rewrites those protocols into concrete ranges; npm's own
// pack does not, which is how lit-ui-router 1.3.0–1.5.0 published manifests
// consumers cannot install. Packing here — in the ci pipeline, with the same
// pnpm the publish workflow uses — keeps main releasable instead of
// discovering a leak at publish time.
//
// This file is the IO shell: it reads each non-private package's publish-shape
// tarball (produced once by the `@tools/release#pack` task this depends on),
// extracts the packed package.json, and delegates all decisions to the pure,
// unit-tested functions in ./check-pack.core.ts.

import { packTarballPath } from './cache-paths.ts';
import {
  findUnsubstitutedRefs,
  formatReport,
  type PackResult,
} from './check-pack.core.ts';
import { assertSelfDeclaredDeps } from './self-deps.ts';
import { tarballManifest } from './tarball.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

async function main() {
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(
    (member) =>
      member.dir !== '<root>' &&
      member.manifest &&
      member.manifest.private !== true,
  );
  await assertSelfDeclaredDeps(publishable.map(({ name }) => name));
  const results: PackResult[] = [];
  for (const { name, dir } of publishable) {
    // Malformed manifests reject in tarballManifest — loud, never a silent {}.
    const manifest = await tarballManifest(packTarballPath(name));
    results.push({ name, dir, refs: findUnsubstitutedRefs(manifest) });
  }
  const { ok, text } = formatReport(results);
  (ok ? console.log : console.error)(text);
  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
