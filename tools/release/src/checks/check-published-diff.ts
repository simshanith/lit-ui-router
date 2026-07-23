#!/usr/bin/env node
// Report whether a publish from the working tree would ship different bytes
// than each package's `latest` on npm. This mechanizes release triage: a
// devDependency- or script-only change is provably a no-op (the publish
// workflow strips those fields before packing), while dist drift from a
// "cosmetic" refactor is caught even when the git log looks harmless.
//
// Method (validated against the 1.7.0 release, whose local rebuild reproduces
// the registry tarball byte-for-byte): reproduce the Pack step
// (//tools/release:pack) by running its own strippedManifest, then `pnpm pack`,
// and `npm diff` the tarball against the published spec. Sharing the strip
// itself is what keeps the two in lockstep.
// Comparing anything other than pack output (the source
// manifest, `npm view` fields) false-positives on catalog:/workspace:
// substitution and registry-injected fields.
//
// Run `turbo run build` first so dist is current; `--strict` turns drift into
// a failing exit (default is an informational report — drift usually means "a
// release is owed", not "the tree is broken"). The per-package machine
// verdict (see summarizeResults) always lands at .cache/
// published-diff-summary.json — the turbo task's output; `--json <path>`
// overrides the destination ad hoc.
//
// Registry state arrives through published-versions.json, written by
// resolve-published.ts just before this runs (the root script chains them) —
// no npm lookups here, so the turbo task caching this check stays a pure
// function of its file inputs.
//
// This file is the IO shell; verdicts and rendering live in the pure,
// unit-tested ./check-published-diff.core.ts.

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

import { readProjectManifest } from '@pnpm/workspace.project-manifest-reader';

import { publishedDiffSummaryPath } from './cache-paths.ts';
import { strippedManifest } from '../steps/release-pack.core.ts';
import {
  changedFiles,
  classifyFiles,
  type DiffResult,
  formatReport,
  hasFileSetChange,
  isCleanDiff,
  isManifestDriftInert,
  manifestDriftFields,
  renderSummary,
  scopePackages,
  summarizeResults,
} from './check-published-diff.core.ts';
import { pnpmPack } from './pack.ts';
import { fetchTarball, tarballManifest } from './tarball.ts';
import { readPublishedVersions } from './published-versions.ts';
import { assertSelfDeclaredDeps } from './self-deps.ts';
import { loadWorkspace, workspaceRoot } from '@tools/shared/workspace.ts';

const run = promisify(execFile);
const MAX_BUFFER = 64 * 1024 * 1024;

/**
 * Pack `dir` the way the publish workflow does and diff against `spec`.
 * The manifest strip mutates package.json in place, so the original bytes are
 * restored afterwards no matter what — user edits and formatting included.
 */
async function diffAgainstPublished(
  dir: string,
  spec: string,
): Promise<{
  diff: string;
  localManifest?: Record<string, unknown>;
  publishedManifest?: Record<string, unknown>;
}> {
  const manifestPath = join(dir, 'package.json');
  const originalManifest = await readFile(manifestPath);
  const destination = await mkdtemp(join(tmpdir(), 'check-published-diff-'));
  const tarball = join(destination, 'package.tgz');
  try {
    const { manifest, writeProjectManifest } = await readProjectManifest(dir);
    await writeProjectManifest(strippedManifest(manifest));
    await pnpmPack(dir, tarball);
    const { stdout } = await run(
      'npm',
      ['diff', `--diff=${spec}`, `--diff=${tarball}`],
      { cwd: workspaceRoot, maxBuffer: MAX_BUFFER },
    );
    if (!changedFiles(stdout).includes('package.json')) {
      return { diff: stdout };
    }
    // Both manifests as-shipped, read from the compared tarballs — the
    // LOCAL side must come from the pack too (pnpm substitutes catalog:/
    // workspace: refs at pack time; the on-disk manifest would false-drift).
    // fetchTarball serves from pacote's cacache — npm diff already pulled
    // the same tarball — so this costs no second download.
    try {
      const localManifest = await tarballManifest(tarball);
      const publishedTarball = join(destination, 'published.tgz');
      await fetchTarball(spec, publishedTarball);
      const publishedManifest = await tarballManifest(publishedTarball);
      return { diff: stdout, localManifest, publishedManifest };
    } catch {
      // Failed fetch/parse leaves the manifests undefined — package.json
      // stays ship-affecting (fail safe).
      return { diff: stdout };
    }
  } finally {
    await writeFile(manifestPath, originalManifest);
    await rm(destination, { recursive: true, force: true });
  }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const skipBuild = process.argv.includes('--no-build');
  // The summary always lands at the canonical .cache path (the turbo task's
  // declared output); --json is an ad-hoc override only.
  const jsonFlag = process.argv.indexOf('--json');
  const jsonOverride = jsonFlag === -1 ? undefined : process.argv[jsonFlag + 1];
  if (jsonFlag !== -1 && (!jsonOverride || jsonOverride.startsWith('--'))) {
    throw new Error('--json requires a file path argument');
  }
  const jsonPath = jsonOverride ?? publishedDiffSummaryPath;

  const published = await readPublishedVersions();
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(
    (member) =>
      member.dir !== '<root>' &&
      member.manifest &&
      member.manifest.private !== true,
  );
  await assertSelfDeclaredDeps(publishable.map(({ name }) => name));

  // PUBLISHED_DIFF_PACKAGES scopes dispatch re-runs; empty/unset = all.
  const scoped = scopePackages(
    publishable.map(({ name }) => name),
    process.env.PUBLISHED_DIFF_PACKAGES,
  );
  const targets = publishable.filter(({ name }) => scoped.includes(name));

  if (!skipBuild && targets.length > 0) {
    // Bare turbo (mise-provisioned), never through pnpm run — pnpm's relative
    // .bin PATH breaks turbo's child process spawning.
    await run('turbo', ['run', ...targets.map(({ name }) => `${name}#build`)], {
      cwd: workspaceRoot,
      maxBuffer: MAX_BUFFER,
    });
  }

  const results: DiffResult[] = [];
  for (const { name, dir } of targets) {
    const packageDir = join(workspaceRoot, dir);
    const localVersion = (
      JSON.parse(await readFile(join(packageDir, 'package.json'), 'utf8')) as {
        version?: string;
      }
    ).version;
    if (!(name in published)) {
      throw new Error(
        `${name} missing from published-versions.json — stale manifest; re-run the resolve:published task.`,
      );
    }
    const latest = published[name];
    if (!latest) {
      results.push({ name, dir, localVersion, status: 'unpublished' });
      continue;
    }
    const { diff, localManifest, publishedManifest } =
      await diffAgainstPublished(packageDir, `${name}@${latest}`);
    if (isCleanDiff(diff)) {
      results.push({ name, dir, latest, localVersion, status: 'clean' });
      continue;
    }
    let { shipAffecting, shipInert } = classifyFiles(changedFiles(diff));
    if (
      shipAffecting.includes('package.json') &&
      localManifest !== undefined &&
      publishedManifest !== undefined
    ) {
      let manifestInert = false;
      try {
        manifestInert = isManifestDriftInert({
          fileSetChanged: hasFileSetChange(diff),
          driftFields: manifestDriftFields(publishedManifest, localManifest),
        });
      } catch {
        // Unparsable manifest bytes stay ship-affecting.
      }
      if (manifestInert) {
        shipAffecting = shipAffecting.filter((file) => file !== 'package.json');
        shipInert = [...shipInert, 'package.json'].sort();
      }
    }
    results.push({
      name,
      dir,
      latest,
      localVersion,
      status: shipAffecting.length > 0 ? 'drift' : 'ship-inert',
      files: shipAffecting,
      shipInertFiles: shipInert,
    });
  }

  await mkdir(dirname(jsonPath), { recursive: true });
  await writeFile(jsonPath, renderSummary(summarizeResults(results)));

  const { ok, text } = formatReport(results, { strict });
  (ok ? console.log : console.error)(text);
  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
