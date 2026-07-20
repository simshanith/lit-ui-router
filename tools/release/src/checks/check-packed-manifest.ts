#!/usr/bin/env node
// Gate the tarball the publish workflow is about to hand release-it: the
// workflow strips devDependencies/scripts before `pnpm pack`, and pnpm must
// have substituted every catalog:/workspace: ref — so
// `node tools/release/check-packed-manifest.ts <tarball>` fails the publish when
// any of that leaked into the manifest npm would ship (the 1.3.0–1.5.0
// broken-publish class).
//
// This file is the IO shell: it extracts package/package.json from the
// tarball and delegates all decisions to the pure, unit-tested functions in
// ./check-pack.core.ts.

import {
  findPackedManifestViolations,
  formatPackedManifestReport,
} from './check-pack.core.ts';
import { tarballManifest } from './tarball.ts';
import type { PackageManifest } from '@tools/shared/types.ts';

const [tarball, ...extra] = process.argv.slice(2);
if (!tarball || extra.length > 0) {
  console.error('usage: node tools/release/check-packed-manifest.ts <tarball>');
  process.exit(1);
}

// Malformed manifests reject in tarballManifest — the gate fails loudly,
// never a silent `{}` that absence-checks would pass.
const manifest = (await tarballManifest(tarball)) as PackageManifest;
const { ok, text } = formatPackedManifestReport(
  findPackedManifestViolations(manifest),
);
(ok ? console.log : console.error)(text);
if (!ok) process.exitCode = 1;
