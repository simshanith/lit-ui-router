#!/usr/bin/env node
// Bump-time dependent floor gate — the bump's after:bump hook runs it once
// `pnpm install --lockfile-only --fix-lockfile` has unlinked the floor aliases
// the bump moved off the workspace, before release-it commits and pushes:
//   env in: PACKAGE (already bumped in its package.json)
// Relinks the dependents' node_modules from the fixed lockfile, runs each
// dependent's check:bundle and typecheck:peer-floor, and fails the bump
// naming every dependent whose floor stops proving its range. Decisions live
// in ./release-dependent-floor-gate.core.ts.

import { join } from 'node:path';

import { requireManifest } from '@tools/bootstrap/manifest.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { defaultStream } from '@tools/shared/exec.ts';
import { group, runMain } from '@tools/shared/gha.ts';
import { loadWorkspace, selectCatalogs } from '@tools/shared/workspace.ts';

import { requireEnv } from '../lib/env.core.ts';
import {
  type Dependent,
  dependentsOf,
  failureMessage,
  installArgs,
} from './release-dependent-floor-gate.core.ts';

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE');
  const { members, workspaceManifest } = await loadWorkspace(workspaceRoot);
  const dependents = dependentsOf(packageName, members);

  if (dependents.length === 0) {
    console.log(`${packageName} has no published dependent with a floor guard`);

    return;
  }

  const dir = members.find(({ name }) => name === packageName)?.dir ?? '';
  const { version } = requireManifest(join(workspaceRoot, dir));

  if (version === undefined) throw new Error(`${packageName} has no version`);

  await group('relink dependents from the fixed lockfile', () =>
    defaultStream('pnpm', installArgs(dependents), { cwd: workspaceRoot }),
  );

  const failed: Dependent[] = [];

  for (const dependent of dependents) {
    await group(`floor guards: ${dependent.name}`, () =>
      defaultStream('turbo', dependent.turboArgs, { cwd: workspaceRoot }),
    ).catch(() => failed.push(dependent));
  }

  if (failed.length === 0) {
    console.log(
      `${dependents.map(({ name }) => name).join(', ')}: floors prove their ranges with ${packageName}@${version}`,
    );

    return;
  }

  const catalogs = await selectCatalogs(workspaceManifest);

  throw new Error(
    failureMessage({
      packageName,
      version,
      failed,
      rangeOf: (catalog) =>
        catalog === undefined ? undefined : catalogs[catalog]?.[packageName],
    }),
  );
});
