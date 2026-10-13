// `pnpm audit` over the tree the workspace ships and tests. The peerFloor*
// catalog aliases install each published peer floor for check:bundle, and
// pnpm's ignore list is per advisory and lockfile-wide, so it can't accept a
// finding on a floor copy without hiding it on the real one. Findings only a
// floor alias reaches are accepted, unless the published peer range holds no
// patched version: that's a support decision.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import * as v from 'valibot';

import { readManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  loadWorkspaceManifest,
  selectCatalogs,
} from '@tools/shared/workspace.ts';

import {
  AuditSchema,
  SeveritySchema,
  atOrAbove,
  classify,
  floorAliases,
  floorSummary,
  formatFinding,
  formatUnfixed,
  type ListedProject,
  partition,
} from './audit.core.ts';
import { parseLock } from './single-version.core.ts';

const CHECK = 'check-audit';

const main = async (): Promise<void> => {
  const { values } = parseArgs({
    options: { 'audit-level': { type: 'string', default: 'high' } },
    strict: true,
  });

  const level = v.parse(SeveritySchema, values['audit-level']);

  const lock = parseLock(
    readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8'),
  );

  const floors = floorAliases(
    lock,
    await selectCatalogs(loadWorkspaceManifest(workspaceRoot)),
    (importer) => readManifest(join(workspaceRoot, importer))?.peerDependencies,
  );

  // SAFETY: pnpm list --json prints an array of projects in the ListedProject shape
  const projects = JSON.parse(
    execFileSync(
      'pnpm',
      ['list', '-r', '--lockfile-only', '--json', '--depth', 'Infinity'],
      { cwd: workspaceRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ),
  ) as ListedProject[];

  // pnpm audit exits 1 whenever it finds anything, so the JSON is the verdict
  const audit = spawnSync('pnpm', ['audit', '--json'], {
    cwd: workspaceRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });

  const report = v.safeParse(
    v.pipe(v.string(), v.parseJson(), AuditSchema),
    audit.stdout,
  );

  if (audit.status === null || audit.status > 1 || !report.success) {
    console.error(audit.stderr || audit.stdout);
    console.error(
      `${CHECK}: pnpm audit --json exited ${audit.status} without an advisory report`,
    );
    process.exitCode = 1;

    return;
  }

  const verdict = classify(
    Object.values(report.output.advisories),
    partition(projects, floors),
    floors,
  );

  for (const line of floorSummary(verdict.floorOnly)) {
    console.log(`${CHECK}: floor copy ${line}`);
  }

  const failures = [
    ...verdict.real
      .filter(({ advisory }) => atOrAbove(advisory.severity, level))
      .map(
        (finding) =>
          `${formatFinding(finding)}: reached outside the peer floors`,
      ),
    ...verdict.unfixedInRange
      .filter(({ advisory }) => atOrAbove(advisory.severity, level))
      .map(formatUnfixed),
  ];

  for (const finding of verdict.real) {
    if (!atOrAbove(finding.advisory.severity, level)) {
      console.warn(`${CHECK}: below ${level}: ${formatFinding(finding)}`);
    }
  }

  for (const finding of verdict.unfixedInRange) {
    if (!atOrAbove(finding.advisory.severity, level)) {
      console.warn(`${CHECK}: below ${level}: ${formatUnfixed(finding)}`);
    }
  }

  for (const failure of failures) console.error(`${CHECK}: ${failure}`);

  if (failures.length > 0) {
    console.error(
      `${CHECK}: ${failures.length} at or above ${level}; upgrade or override the real copy, and treat a peer range with no patched version as a decision to raise the floor`,
    );
    process.exitCode = 1;

    return;
  }

  console.log(
    `${CHECK}: no ${level}+ advisory outside the peer floors; ${verdict.floorOnly.length} floor-only finding(s) accepted, ${verdict.real.length} below ${level} on the real tree`,
  );
};

if (import.meta.main) await main();
