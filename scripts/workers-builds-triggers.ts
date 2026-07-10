#!/usr/bin/env node
// Dashboard-as-code for the Cloudflare Workers Builds triggers that deploy
// lit-ui-router.dev. The dashboard config has no PR trail, so DESIRED below is
// the reviewable source of truth the dashboard should match.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node scripts/workers-builds-triggers.ts [--apply]
//
// Default is a read-only diff. --apply PATCHes drifted triggers, then re-GETs
// to confirm. Exit codes: 0 in sync, 1 drifted (or drift remained after
// --apply), 2 usage/API error. Token needs "Workers Builds Configuration:
// Edit" (user-scoped). Never wire this into CI's task graph — it reads (and
// with --apply, writes) production deploy configuration.
//
// This file is the IO shell: env, wrangler.jsonc, and the Cloudflare API
// (https://developers.cloudflare.com/workers/ci-cd/builds/api-reference/).
// All decisions live in the pure, unit-tested workers-builds-triggers.core.ts.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  type DesiredState,
  type Trigger,
  diffTriggers,
  parseJsonc,
  workerNameFromConfig,
} from './workers-builds-triggers.core.ts';

// Source of truth for the dashboard. Mirrors the CURRENT dashboard values —
// change this constant first, then run with --apply.
const DESIRED: DesiredState = {
  productionBranch: 'main',
  production: {
    build_command: 'npx turbo docs#build',
    deploy_command: 'pnpm wrangler deploy',
  },
  preview: {
    build_command: 'npx turbo docs#build',
    deploy_command: 'pnpm wrangler versions upload',
  },
  // Alias-free alternatives (verified in DEPLOY.md — work from either root
  // directory, with or without the docs `wrangler` package.json script):
  //   production: { deploy_command: 'pnpm --filter docs exec wrangler deploy' }
  //   preview: { deploy_command: 'pnpm --filter docs exec wrangler versions upload' }
};

const API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

type CloudflareEnvelope = {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: unknown;
};

// The token itself must never reach stdout/stderr — errors carry only the
// API's own status and messages.
async function cf(
  token: string,
  path: string,
  init?: { method: 'PATCH'; body: unknown },
): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init ? { 'content-type': 'application/json' } : {}),
    },
    body: init ? JSON.stringify(init.body) : undefined,
  });
  const envelope = (await response.json()) as CloudflareEnvelope;
  if (!response.ok || envelope.success === false) {
    const details = (envelope.errors ?? [])
      .map((error) => `${error.code ?? '?'}: ${error.message ?? '?'}`)
      .join('; ');
    throw new Error(
      `Cloudflare API ${init?.method ?? 'GET'} ${path} failed (HTTP ${response.status})${details ? ` — ${details}` : ''}`,
    );
  }
  return envelope.result;
}

async function workerTag(
  token: string,
  accountId: string,
  name: string,
): Promise<string> {
  const scripts = (await cf(token, `/${accountId}/workers/scripts`)) as {
    id?: string;
    tag?: string;
  }[];
  const script = scripts.find((candidate) => candidate.id === name);
  if (!script?.tag) {
    throw new Error(`worker "${name}" not found in account's workers/scripts`);
  }
  return script.tag;
}

async function getTriggers(
  token: string,
  accountId: string,
  tag: string,
): Promise<Trigger[]> {
  return (await cf(
    token,
    `/${accountId}/builds/workers/${tag}/triggers`,
  )) as Trigger[];
}

async function main() {
  const apply = process.argv.includes('--apply');

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    console.error(
      'Missing required env: set CLOUDFLARE_API_TOKEN (user token with ' +
        '"Workers Builds Configuration: Edit") and CLOUDFLARE_ACCOUNT_ID.',
    );
    process.exitCode = 2;
    return;
  }

  // The worker name comes from the same config wrangler deploys with.
  const configPath = join(import.meta.dirname, '..', 'wrangler.jsonc');
  const name = workerNameFromConfig(
    parseJsonc(await readFile(configPath, 'utf8')),
  );

  const tag = await workerTag(token, accountId, name);
  const { report, drifts } = diffTriggers(
    await getTriggers(token, accountId, tag),
    DESIRED,
  );
  console.log(`worker: ${name} (${tag})\n`);
  console.log(report.text);

  if (!apply) {
    if (!report.ok) {
      console.log('\nRun with --apply to update the drifted triggers.');
      process.exitCode = 1;
    }
    return;
  }

  for (const drift of drifts) {
    console.log(
      `\nPATCHing ${drift.kind} trigger ${drift.trigger_uuid}: ${Object.keys(drift.patch).join(', ')}`,
    );
    await cf(token, `/${accountId}/builds/triggers/${drift.trigger_uuid}`, {
      method: 'PATCH',
      body: drift.patch,
    });
  }

  // Re-read so the confirmation reflects what the API stored, not what we sent.
  const after = diffTriggers(await getTriggers(token, accountId, tag), DESIRED);
  console.log(`\nAfter --apply:\n\n${after.report.text}`);
  if (!after.report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 2;
});
