#!/usr/bin/env node
// Dashboard-as-code for the Cloudflare Workers Builds triggers that deploy this
// repo's sites. The dashboard config has no PR trail, so the sibling
// workers-builds-triggers.config.jsonc is the reviewable source of truth the
// dashboard should match — one entry per Worker, keyed by site.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… pnpm check:workers-builds [-- [--site <key>]… [--apply]]
//
// Default is a read-only diff of every configured site. --site limits both
// the diff and --apply to the named config keys (repeatable, or one
// comma-separated value); an unknown key is a usage error, never an empty
// selection. --apply PATCHes drifted triggers, then re-GETs to confirm. Exit
// codes: 0 in sync, 1 drifted, a configured worker not created yet, or drift
// remaining after --apply, 2 usage/API error. Token must be USER-scoped (account-owned tokens don't cover the
// Builds API): "Workers Builds Configuration: Read" suffices for the diff,
// Edit is only for --apply.
//
// Never make this a turbo task-graph dependency: it hits the live API, so no
// build/test/typecheck task may reach it. Running the default read-only diff
// from CI is fine and intended — release-signals.yml reports it as a
// non-gating check run (#280 Phase 1) using a read-scoped token; --apply,
// which writes production deploy configuration, stays manual.
//
// This file is the IO shell: env, the worker configs, and the Cloudflare API
// (https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/).
// All decisions live in the pure, unit-tested workers-builds-triggers.core.ts.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { loadAndParseConfig } from '@cloudflare/config';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { messageOf } from '@tools/shared/errors.ts';

import { cf } from './cloudflare-api.ts';
import {
  CF_CONFIG,
  type DesiredWorker,
  type Drift,
  PREVIEWS_BASE_CONFIG,
  type PreviewsBaseConfig,
  type Trigger,
  desiredWorkersFromConfig,
  diffTriggers,
  parseJsonc,
  previewsBaseTrigger,
  selectWorkers,
  workerNameFromConfig,
} from './workers-builds-triggers.core.ts';

/** The worker a config file names; cf's own loader evaluates a cloudflare.config.ts as a production deploy does. */
export const workerName = async (path: string): Promise<string> => {
  if (!path.endsWith(CF_CONFIG)) {
    return workerNameFromConfig(parseJsonc(await readFile(path, 'utf8')));
  }

  const { result } = await loadAndParseConfig(path, {
    isPreview: false,
    mode: undefined,
  });

  if (!result.success) throw new Error(`${path}: ${result.error.message}`);

  if (!result.data.worker) throw new Error(`${path} defines no worker`);

  return result.data.worker.name;
};

// The desired-state source of truth, validated at load time.
const DESIRED_CONFIG = join(
  import.meta.dirname,
  'workers-builds-triggers.config.jsonc',
);

async function loadDesired(): Promise<DesiredWorker[]> {
  try {
    return desiredWorkersFromConfig(
      parseJsonc(await readFile(DESIRED_CONFIG, 'utf8')),
    );
  } catch (error) {
    throw new Error(
      `cannot load desired state from ${DESIRED_CONFIG}: ${messageOf(error)}`,
      { cause: error },
    );
  }
}

// undefined when the account has no such worker yet.
async function workerTag(
  token: string,
  accountId: string,
  name: string,
): Promise<string | undefined> {
  // SAFETY: workers/scripts results are script objects carrying id and tag
  const scripts = (await cf(token, `/${accountId}/workers/scripts`)) as {
    id?: string;
    tag?: string;
  }[];

  return scripts.find((candidate) => candidate.id === name)?.tag;
}

// Build environment variables live on a sub-resource; the trigger list may or
// may not inline them, so fetch only when it doesn't.
async function getTriggers(
  token: string,
  accountId: string,
  tag: string,
): Promise<Trigger[]> {
  // SAFETY: the triggers endpoint returns trigger objects; Trigger is a subset
  const triggers = (await cf(
    token,
    `/${accountId}/builds/workers/${tag}/triggers`,
  )) as Trigger[];

  const withEnvironment = await Promise.all(
    triggers.map(async (trigger) =>
      trigger.environment_variables
        ? trigger
        : {
            ...trigger,
            // SAFETY: this sub-resource returns the trigger's variable map
            environment_variables: (await cf(
              token,
              `/${accountId}/builds/triggers/${trigger.trigger_uuid}/environment_variables`,
            )) as Trigger['environment_variables'],
          },
    ),
  );

  // SAFETY: the Worker's build configuration; only these two fields are read
  const worker = (await cf(token, `/${accountId}/builds/workers/${tag}`)) as {
    previews_enabled?: boolean;
    previews_base_config?: PreviewsBaseConfig | null;
  };

  return worker.previews_enabled && worker.previews_base_config
    ? [...withEnvironment, previewsBaseTrigger(worker.previews_base_config)]
    : withEnvironment;
}

async function applyDrift(
  token: string,
  accountId: string,
  tag: string,
  drift: Drift,
): Promise<void> {
  if (drift.trigger_uuid === PREVIEWS_BASE_CONFIG) {
    console.log(
      `\nPATCHing ${PREVIEWS_BASE_CONFIG}: ${[...Object.keys(drift.patch), ...Object.keys(drift.environmentPatch)].join(', ')}`,
    );
    await cf(token, `/${accountId}/builds/workers/${tag}`, {
      method: 'PATCH',
      body: {
        [PREVIEWS_BASE_CONFIG]: {
          ...drift.patch,
          ...(Object.keys(drift.environmentPatch).length > 0 && {
            environment_variables: drift.environmentPatch,
          }),
        },
      },
    });

    return;
  }

  if (Object.keys(drift.patch).length > 0) {
    console.log(
      `\nPATCHing ${drift.kind} trigger ${drift.trigger_uuid}: ${Object.keys(drift.patch).join(', ')}`,
    );
    await cf(token, `/${accountId}/builds/triggers/${drift.trigger_uuid}`, {
      method: 'PATCH',
      body: drift.patch,
    });
  }

  // Declared keys only — undeclared live vars are never in this body.
  if (Object.keys(drift.environmentPatch).length > 0) {
    console.log(
      `\nPATCHing ${drift.kind} trigger ${drift.trigger_uuid} environment_variables: ${Object.keys(drift.environmentPatch).join(', ')}`,
    );
    await cf(
      token,
      `/${accountId}/builds/triggers/${drift.trigger_uuid}/environment_variables`,
      { method: 'PATCH', body: drift.environmentPatch },
    );
  }
}

async function main() {
  // strict: an unknown flag is a usage error (exit 2 via the catch below), so
  // a mistyped --apply can never fall through to a read-only run that looks
  // like it applied.
  const { values } = parseArgs({
    options: {
      apply: { type: 'boolean', default: false },
      site: { type: 'string', multiple: true, default: [] },
    },
    strict: true,
  });

  const apply = values.apply;
  const sites = values.site.flatMap((value) => value.split(','));

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token || !accountId) {
    console.error(
      'Missing required env: set CLOUDFLARE_API_TOKEN (user token with ' +
        '"Workers Builds Configuration: Read", Edit for --apply) and ' +
        'CLOUDFLARE_ACCOUNT_ID.',
    );
    process.exitCode = 2;

    return;
  }

  const selected = selectWorkers(await loadDesired(), sites);

  if (!selected.ok) {
    console.error(selected.error);
    process.exitCode = 2;

    return;
  }

  let ok = true;

  for (const [index, worker] of selected.workers.entries()) {
    // The worker name comes from the same config the deploy uses. A
    // workerConfig that names no file throws, and the run exits 2.
    const name = await workerName(join(workspaceRoot, worker.workerConfig));

    const tag = await workerTag(token, accountId, name);

    // A configured site whose worker the dashboard hasn't created yet is
    // drift the dashboard owes, not an observer error: it must not mask the
    // other sites' verdicts.
    if (tag === undefined) {
      console.log(
        `${index > 0 ? '\n' : ''}worker: ${name} (not found)\n\n` +
          `✗ no worker "${name}" in the account — create it with its triggers in the dashboard (see www/DEPLOY.md, Adding a site)`,
      );
      ok = false;
      continue;
    }

    const { report, drifts } = diffTriggers(
      await getTriggers(token, accountId, tag),
      worker,
    );

    console.log(`${index > 0 ? '\n' : ''}worker: ${name} (${tag})\n`);
    console.log(report.text);

    if (!apply) {
      if (!report.ok) ok = false;
      continue;
    }

    for (const drift of drifts) await applyDrift(token, accountId, tag, drift);

    // Re-read so the confirmation reflects what the API stored, not what we sent.
    const after = diffTriggers(
      await getTriggers(token, accountId, tag),
      worker,
    );

    console.log(`\nAfter --apply:\n\n${after.report.text}`);

    if (!after.report.ok) ok = false;
  }

  if (ok) return;

  if (!apply) console.log('\nRun with --apply to update the drifted triggers.');
  process.exitCode = 1;
}

if (import.meta.main) {
  main().catch((cause: unknown) => {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exitCode = 2;
  });
}
