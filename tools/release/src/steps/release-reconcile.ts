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
// witness, never a trust source. Only a proven drift halts: a credit we cannot
// obtain or trust (cold/evicted cache, unreachable remote, unreadable summary)
// is unverifiable — warn and proceed on the trusted debit, because failing the
// publish over a cache outage would trade a supply-chain gate for an
// availability one. Verdict logic is in ./release-reconcile.core.ts.

import { createHash } from 'node:crypto';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { packTarballPath } from '../checks/cache-paths.ts';
import {
  type CacheOutcome,
  packCacheOutcome,
  reconcile,
  type Verdict,
} from './release-reconcile.core.ts';
import { defaultExec } from '@tools/shared/exec.ts';
import { group, logWarning, runMain } from '@tools/shared/gha.ts';
import { requireEnv } from '@tools/shared/env.core.ts';
import { workspaceRoot } from '@tools/shared/workspace.ts';

const PACK_TASK = '@tools/release#pack:all';

async function sha256File(path: string): Promise<string> {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}

/** The credit ledger, or why we could not obtain one. */
type Credit = { sha: string; outcome: CacheOutcome } | { failure: string };

/**
 * Restore CI's pack:all and hash the tarball it left behind. `local:rw` (not
 * `local:w`) so this job's own cold `^build` outputs satisfy pack:all's
 * dependencies instead of being re-pulled from the remote cache; pack:all
 * itself has no local entry, and only a REMOTE source is ever credited.
 */
async function restoreCredit(
  creditPath: string,
  runsDir: string,
): Promise<Credit> {
  try {
    // Bare turbo (mise shim on PATH), never via pnpm (relative .bin PATH
    // breaks turbo's child spawning). --summarize records the cache outcome.
    await rm(runsDir, { recursive: true, force: true });
    await defaultExec(
      'turbo',
      ['run', PACK_TASK, '--cache=remote:r,local:rw', '--summarize'],
      { cwd: workspaceRoot },
    );

    const runs = (await readdir(runsDir)).filter((file) =>
      file.endsWith('.json'),
    );
    if (runs.length !== 1) {
      return {
        failure: `expected exactly one turbo run summary in ${runsDir}, found ${runs.length}`,
      };
    }
    const summary = JSON.parse(
      await readFile(join(runsDir, runs[0]), 'utf8'),
    ) as unknown;

    return {
      sha: await sha256File(creditPath),
      outcome: packCacheOutcome(summary, PACK_TASK),
    };
  } catch (error: unknown) {
    return {
      failure: `could not restore the CI-verified pack: ${String(error)}`,
    };
  }
}

runMain(async () => {
  const packageName = requireEnv(process.env, 'PACKAGE_NAME');
  const debitPath = requireEnv(process.env, 'TARBALL');
  const creditPath = packTarballPath(packageName);
  const runsDir = join(workspaceRoot, '.turbo', 'runs');

  await group(
    `reconcile ${packageName}: cold bake vs CI-verified pack`,
    async () => {
      // The debit is ours and must always hash — a failure here is a real bug.
      const debitSha = await sha256File(debitPath);
      const credit = await restoreCredit(creditPath, runsDir);
      const creditSha = 'failure' in credit ? undefined : credit.sha;
      const verdict: Verdict =
        'failure' in credit
          ? { kind: 'unverifiable', reason: credit.failure }
          : reconcile(debitSha, credit.sha, credit.outcome);

      switch (verdict.kind) {
        case 'balanced':
          console.log(
            `✓ reconciled ${packageName}: cold bake ≡ CI-verified pack (sha256 ${debitSha})`,
          );
          return;
        case 'unverifiable':
          logWarning(
            `reconcile skipped for ${packageName}: ${verdict.reason}. Publishing the trusted cold-baked tarball, uncross-checked against CI.`,
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
