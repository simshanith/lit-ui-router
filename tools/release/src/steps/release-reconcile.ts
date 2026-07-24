#!/usr/bin/env node
// Double-entry reconciliation — the publish-path supply-chain gate.
//   env in:  PACKAGE_NAME, TARBALL (the cold-baked publish tarball = the DEBIT)
//   effect:  HALTS the publish when the CI-verified CREDIT tarball drifts
//
// Two independently-derived ledgers must balance before we attest + publish:
//   Debit  (.cache/publish/<name>.tgz): re-baked cold in THIS job from the
//     checked-out tag. Trusted by construction — the publish build withholds
//     TURBO_TOKEN, so no unsigned remote-cache artifact reaches it. These are
//     the bytes we attest and publish.
//   Credit (.cache/pack/<name>.tgz): the SAME @tools/release#pack:all tarball
//     check:pack / check:exports / check:published-diff validated in CI,
//     restored here from the remote cache read-only.
// packPublishTarball is byte-deterministic (pnpm normalizes tar mtime + gzip;
// check:published-diff banks on the same reproducibility), so honest inputs
// balance byte-for-byte. A mismatch means CI verified bytes a clean rebuild
// cannot reproduce — remote-cache poisoning or a determinism regression — and
// HALTS the publish. The attested bytes are always the debit; the credit is a
// witness, never a trust source. When the credit is not a genuine remote hit
// (cache cold/evicted) there is nothing to cross-check, so this warns and
// proceeds on the trusted debit. Verdict logic is in ./release-reconcile.core.ts.

import { createHash } from 'node:crypto';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { packTarballPath } from '../checks/cache-paths.ts';
import { packCacheOutcome, reconcile } from './release-reconcile.core.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import { group, runMain } from '@tools/shared/gha.ts';
import { requireEnv } from '@tools/shared/env.core.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

const PACK_TASK = '@tools/release#pack:all';

async function sha256File(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE_NAME');
  const debitPath = requireEnv(process.env, 'TARBALL');
  const creditPath = packTarballPath(packageName);
  const runsDir = join(workspaceRoot, '.turbo', 'runs');

  await group(
    `reconcile ${packageName}: cold bake vs CI-verified pack`,
    async () => {
      // Restore CI's pack:all from the remote cache only (local:w = never read
      // a local entry, so only a genuine remote artifact — or a fresh local
      // exec on a miss — can satisfy it). --summarize records which happened.
      // Bare turbo (mise shim on PATH), never via pnpm (relative .bin PATH
      // breaks turbo's child spawning).
      await rm(runsDir, { recursive: true, force: true });
      await defaultExec(
        'turbo',
        ['run', PACK_TASK, '--cache=remote:r,local:w', '--summarize'],
        { cwd: workspaceRoot },
      );

      const runs = (await readdir(runsDir)).filter((file) =>
        file.endsWith('.json'),
      );
      if (runs.length !== 1) {
        throw new Error(
          `expected exactly one turbo run summary in ${runsDir}, found ${runs.length}`,
        );
      }
      const summary = JSON.parse(
        await readFile(join(runsDir, runs[0]), 'utf8'),
      ) as unknown;

      const outcome = packCacheOutcome(summary, PACK_TASK);
      const debitSha = await sha256File(debitPath);
      const creditSha = await sha256File(creditPath);
      const verdict = reconcile(debitSha, creditSha, outcome);

      switch (verdict.kind) {
        case 'balanced':
          console.log(
            `✓ reconciled ${packageName}: cold bake ≡ CI-verified pack (sha256 ${debitSha})`,
          );
          return;
        case 'unverifiable':
          console.warn(
            `⚠ reconcile skipped for ${packageName}: ${verdict.reason}. Publishing the trusted cold-baked tarball, uncross-checked against CI.`,
          );
          return;
        case 'drift':
          throw new Error(
            `double-entry mismatch for ${packageName}: cold bake ${debitSha} != CI-verified ${creditSha}. ` +
              `The CI checks validated bytes a clean rebuild does not reproduce — suspect remote-cache poisoning or a non-deterministic build. Halting publish.`,
          );
      }
    },
  );
});
