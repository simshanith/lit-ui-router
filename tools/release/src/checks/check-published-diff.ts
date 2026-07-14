#!/usr/bin/env node
// Report whether a publish from the working tree would ship different bytes
// than each package's `latest` on npm. This mechanizes release triage: a
// devDependency- or script-only change is provably a no-op (the publish
// workflow strips those fields before packing), while dist drift from a
// "cosmetic" refactor is caught even when the git log looks harmless.
//
// Method (validated against the 1.7.0 release, whose local rebuild reproduces
// the registry tarball byte-for-byte): reproduce the Pack step of
// .github/workflows/publish-npm.yml — `npm pkg delete` the
// STRIPPED_MANIFEST_FIELDS then `pnpm pack` — and `npm diff` the tarball
// against the published spec. The strip stays in lockstep with that workflow
// because both build their delete args from the same list in
// check-pack.core.ts. Comparing anything other than pack output (the source
// manifest, `npm view` fields) false-positives on catalog:/workspace:
// substitution and registry-injected fields.
//
// Run `turbo run build` first so dist is current; `--strict` turns drift into
// a failing exit (default is an informational report — drift usually means "a
// release is owed", not "the tree is broken").
//
// Registry state arrives through published-versions.json, written by
// resolve-published.ts just before this runs (the root script chains them) —
// no npm lookups here, so the turbo task caching this check stays a pure
// function of its file inputs.
//
// This file is the IO shell; verdicts and rendering live in the pure,
// unit-tested ./check-published-diff.core.ts.

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { STRIPPED_MANIFEST_FIELDS } from './check-pack.core.ts';
import {
  changedFiles,
  type DiffResult,
  formatReport,
  isCleanDiff,
} from './check-published-diff.core.ts';
import { pnpmPack } from './pack.ts';
import { readPublishedVersions } from './published-versions.ts';
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
): Promise<string> {
  const manifestPath = join(dir, 'package.json');
  const originalManifest = await readFile(manifestPath);
  const destination = await mkdtemp(join(tmpdir(), 'check-published-diff-'));
  const tarball = join(destination, 'package.tgz');
  try {
    await run('npm', ['pkg', 'delete', ...STRIPPED_MANIFEST_FIELDS], {
      cwd: dir,
    });
    await pnpmPack(dir, tarball);
    const { stdout } = await run(
      'npm',
      ['diff', `--diff=${spec}`, `--diff=${tarball}`],
      { cwd: workspaceRoot, maxBuffer: MAX_BUFFER },
    );
    return stdout;
  } finally {
    await writeFile(manifestPath, originalManifest);
    await rm(destination, { recursive: true, force: true });
  }
}

async function main() {
  const strict = process.argv.includes('--strict');
  const skipBuild = process.argv.includes('--no-build');

  const published = await readPublishedVersions();
  const { members } = await loadWorkspace(workspaceRoot);
  const publishable = members.filter(
    (member) =>
      member.dir !== '<root>' &&
      member.manifest &&
      member.manifest.private !== true,
  );

  if (!skipBuild && publishable.length > 0) {
    // Bare turbo (mise-provisioned), never through pnpm run — pnpm's relative
    // .bin PATH breaks turbo's child process spawning.
    await run(
      'turbo',
      ['run', ...publishable.map(({ name }) => `${name}#build`)],
      { cwd: workspaceRoot, maxBuffer: MAX_BUFFER },
    );
  }

  const results: DiffResult[] = [];
  for (const { name, dir } of publishable) {
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
    const diff = await diffAgainstPublished(packageDir, `${name}@${latest}`);
    results.push(
      isCleanDiff(diff)
        ? { name, dir, latest, localVersion, status: 'clean' }
        : {
            name,
            dir,
            latest,
            localVersion,
            status: 'drift',
            files: changedFiles(diff),
          },
    );
  }

  const { ok, text } = formatReport(results, { strict });
  (ok ? console.log : console.error)(text);
  if (!ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
