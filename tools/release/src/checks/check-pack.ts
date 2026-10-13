#!/usr/bin/env node
// Guard publishable packages against shipping unsubstituted catalog:/workspace:
// refs. `pnpm pack` rewrites those protocols into concrete ranges; npm's own
// pack does not, which is how lit-ui-router 1.3.0–1.5.0 published manifests
// consumers cannot install. Packing here — in the ci pipeline, with the same
// pnpm the publish workflow uses — keeps main releasable instead of
// discovering a leak at publish time.
//
// This file is the IO shell: it reads each non-private package's publish-shape
// tarball (produced once by the `@tools/release#pack:all` task this depends on),
// extracts the packed package.json, and delegates all decisions to the pure,
// unit-tested functions in ./check-pack.core.ts.

import { globSync, readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import pacote from 'pacote';
import * as v from 'valibot';

import { packTarballPath } from './cache-paths.ts';
import {
  findPackedFileProblems,
  findUnsubstitutedRefs,
  formatFileReport,
  formatReport,
  type PackedFile,
  type PackedMap,
  type PackResult,
} from './check-pack.core.ts';
import { tarballManifest } from './tarball.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { isPublishable, loadWorkspace } from '@tools/shared/workspace.ts';
import { failMain } from '../lib/fail-main.ts';

const MapSchema = v.object({
  sources: v.optional(v.array(v.nullable(v.string()))),
  sourcesContent: v.optional(v.array(v.nullable(v.string()))),
});

const TEXT = /\.(?:js|mjs|cjs|ts|mts|cts)$/;

/** Every packed path, the text files to scan, and the parsed sourcemaps. */
async function packedFiles(tarball: string): Promise<{
  paths: string[];
  files: PackedFile[];
  maps: Map<string, PackedMap>;
}> {
  const dest = await mkdtemp(join(tmpdir(), 'check-pack-'));

  try {
    await pacote.extract(`file:${tarball}`, dest);

    const paths = globSync('**/*', { cwd: dest, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        join(entry.parentPath, entry.name).slice(dest.length + 1),
      );

    const read = (path: string) => readFileSync(join(dest, path), 'utf8');

    const files = paths
      .filter((path) => TEXT.test(path))
      .map((path) => ({ path, text: read(path) }));

    const maps = new Map(
      paths
        .filter((path) => path.endsWith('.map'))
        .map((path) => [path, v.parse(MapSchema, JSON.parse(read(path)))]),
    );

    return { paths, files, maps };
  } finally {
    await rm(dest, { recursive: true, force: true });
  }
}

async function main() {
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(isPublishable);
  const results: PackResult[] = [];
  const fileResults: { name: string; problems: string[] }[] = [];

  for (const { name, dir } of publishable) {
    const tarball = packTarballPath(name);
    // Malformed manifests reject in tarballManifest — loud, never a silent {}.
    const manifest = await tarballManifest(tarball);
    results.push({ name, dir, refs: findUnsubstitutedRefs(manifest) });

    const { paths, files, maps } = await packedFiles(tarball);
    fileResults.push({
      name,
      problems: findPackedFileProblems(paths, files, maps),
    });
  }

  const reports = [formatReport(results), formatFileReport(fileResults)];

  for (const { ok, text } of reports) (ok ? console.log : console.error)(text);

  if (reports.some((report) => !report.ok)) process.exitCode = 1;
}

main().catch(failMain);
