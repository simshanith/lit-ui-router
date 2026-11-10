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
import { listScripts } from '@distilled.cloud/cloudflare/workers';
import {
  listTriggers,
  listTriggersEnvironmentVariables,
  updateTrigger,
  upsertTriggersEnvironmentVariable,
} from '@distilled.cloud/cloudflare/workers_builds';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { messageOf } from '@tools/shared/errors.ts';

import { type CloudflareApi, call } from './cloudflare-api.ts';
import {
  getWorkerBuildSettings,
  updateWorkerBuildSettings,
} from './builds-settings.ts';
import {
  CF_CONFIG,
  type DesiredWorker,
  type Drift,
  type EnvironmentPatch,
  PREVIEWS_BASE_CONFIG,
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

// The SDK's camelCase shapes as the wire's snake_case ones the diff reports in.
type SdkBuildFields = {
  buildCommand?: string | null;
  deployCommand?: string | null;
  rootDirectory?: string | null;
  pathIncludes?: readonly string[] | null;
  pathExcludes?: readonly string[] | null;
};

type SdkEnvironment = Record<
  string,
  { isSecret?: boolean | null; value?: string | null } | undefined
>;

const listOf = (list: readonly string[] | null | undefined) =>
  list ? [...list] : undefined;

const wireBuildFields = (fields: SdkBuildFields) => ({
  build_command: fields.buildCommand ?? undefined,
  deploy_command: fields.deployCommand ?? undefined,
  root_directory: fields.rootDirectory ?? undefined,
  path_includes: listOf(fields.pathIncludes),
  path_excludes: listOf(fields.pathExcludes),
});

const wireEnvironment = (
  environment: SdkEnvironment,
): NonNullable<Trigger['environment_variables']> =>
  Object.fromEntries(
    Object.entries(environment).flatMap(([key, variable]) =>
      variable
        ? [
            [
              key,
              {
                value: variable.value ?? undefined,
                is_secret: variable.isSecret ?? undefined,
              },
            ],
          ]
        : [],
    ),
  );

const sdkBuildFields = (patch: Drift['patch']) => ({
  buildCommand: patch.build_command,
  deployCommand: patch.deploy_command,
  rootDirectory: patch.root_directory,
  pathIncludes: patch.path_includes,
  pathExcludes: patch.path_excludes,
});

const sdkEnvironment = (environment: EnvironmentPatch) =>
  Object.fromEntries(
    Object.entries(environment).map(([key, { value, is_secret }]) => [
      key,
      { value, isSecret: is_secret },
    ]),
  );

/** The tag of the named worker; undefined when the account has none yet. */
export async function workerTag(
  api: CloudflareApi,
  name: string,
): Promise<string | undefined> {
  const { result } = await call(
    api,
    'GET /{account_id}/workers/scripts',
    listScripts({ accountId: api.accountId }),
  );

  return result.find((candidate) => candidate.id === name)?.tag ?? undefined;
}

/** The worker's triggers, its Workers Previews base config standing in as one when enabled. */
export async function getTriggers(
  api: CloudflareApi,
  tag: string,
): Promise<Trigger[]> {
  const { accountId } = api;

  const listed = await call(
    api,
    `GET /{account_id}/builds/workers/${tag}/triggers`,
    listTriggers({ accountId, externalScriptId: tag }),
  );

  // Build environment variables live on a sub-resource the SDK's trigger list does not model.
  const triggers = await Promise.all(
    listed.map(async (trigger): Promise<Trigger> => {
      if (!trigger.triggerUuid) {
        throw new Error(`a trigger of worker ${tag} has no trigger_uuid`);
      }

      const environment = await call(
        api,
        `GET /{account_id}/builds/triggers/${trigger.triggerUuid}/environment_variables`,
        listTriggersEnvironmentVariables({
          accountId,
          triggerUuid: trigger.triggerUuid,
        }),
      );

      return {
        trigger_uuid: trigger.triggerUuid,
        trigger_name: trigger.triggerName ?? undefined,
        branch_includes: listOf(trigger.branchIncludes),
        branch_excludes: listOf(trigger.branchExcludes),
        ...wireBuildFields(trigger),
        environment_variables: wireEnvironment(environment),
      };
    }),
  );

  const worker = await call(
    api,
    `GET /{account_id}/builds/workers/${tag}`,
    getWorkerBuildSettings({ accountId, externalScriptId: tag }),
  );

  const base = worker.previewsBaseConfig;

  return worker.previewsEnabled && base
    ? [
        ...triggers,
        previewsBaseTrigger({
          ...wireBuildFields(base),
          ...(base.environmentVariables && {
            environment_variables: wireEnvironment(base.environmentVariables),
          }),
        }),
      ]
    : triggers;
}

/** PATCHes one drift: the trigger and its variables, or the Worker's Previews base config. */
export async function applyDrift(
  api: CloudflareApi,
  tag: string,
  drift: Drift,
): Promise<void> {
  const { accountId } = api;

  if (drift.trigger_uuid === PREVIEWS_BASE_CONFIG) {
    console.log(
      `\nPATCHing ${PREVIEWS_BASE_CONFIG}: ${[...Object.keys(drift.patch), ...Object.keys(drift.environmentPatch)].join(', ')}`,
    );
    await call(
      api,
      `PATCH /{account_id}/builds/workers/${tag}`,
      updateWorkerBuildSettings({
        accountId,
        externalScriptId: tag,
        previewsBaseConfig: {
          ...sdkBuildFields(drift.patch),
          ...(Object.keys(drift.environmentPatch).length > 0 && {
            environmentVariables: sdkEnvironment(drift.environmentPatch),
          }),
        },
      }),
    );

    return;
  }

  if (Object.keys(drift.patch).length > 0) {
    console.log(
      `\nPATCHing ${drift.kind} trigger ${drift.trigger_uuid}: ${Object.keys(drift.patch).join(', ')}`,
    );
    await call(
      api,
      `PATCH /{account_id}/builds/triggers/${drift.trigger_uuid}`,
      updateTrigger({
        accountId,
        triggerUuid: drift.trigger_uuid,
        ...sdkBuildFields(drift.patch),
      }),
    );
  }

  // Declared keys only — undeclared live vars are never in this body.
  if (Object.keys(drift.environmentPatch).length > 0) {
    console.log(
      `\nPATCHing ${drift.kind} trigger ${drift.trigger_uuid} environment_variables: ${Object.keys(drift.environmentPatch).join(', ')}`,
    );
    await call(
      api,
      `PATCH /{account_id}/builds/triggers/${drift.trigger_uuid}/environment_variables`,
      upsertTriggersEnvironmentVariable({
        accountId,
        triggerUuid: drift.trigger_uuid,
        body: sdkEnvironment(drift.environmentPatch),
      }),
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

  const api: CloudflareApi = { token, accountId, fetch: globalThis.fetch };
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

    const tag = await workerTag(api, name);

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
      await getTriggers(api, tag),
      worker,
    );

    console.log(`${index > 0 ? '\n' : ''}worker: ${name} (${tag})\n`);
    console.log(report.text);

    if (!apply) {
      if (!report.ok) ok = false;
      continue;
    }

    for (const drift of drifts) await applyDrift(api, tag, drift);

    // Re-read so the confirmation reflects what the API stored, not what we sent.
    const after = diffTriggers(await getTriggers(api, tag), worker);

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
