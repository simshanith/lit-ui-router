#!/usr/bin/env node
// Wraps a Workers Builds deploy command and records its preview URL as a GitHub
// Deployment on the commit. The deploy's exit code is the reporter's, always;
// reporting failures only warn. Decisions live in github-deployment-reporter.core.ts.
//
// Usage: github-deployment-reporter.ts [--dry-run] [--json | --json-out <path>] -- <command> [args...]
//
// The token (GITHUB_DEPLOYMENTS_TOKEN) needs Deployments: read and write on this
// repository only; it is stripped from the command's environment and scrubbed from logs.
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { jsonOutput, writeJsonOutput } from '@tools/cli/json-output.ts';
import { messageOf } from '@tools/shared/errors.ts';
import * as v from 'valibot';

import {
  DEFAULT_REPOSITORY,
  DeploymentStatusesSchema,
  ListedDeploymentsSchema,
  INACTIVE_STATUS,
  type DeploymentRequests,
  type Env,
  type OutputSource,
  REPOSITORY_ENV,
  TOKEN_ENV,
  USAGE,
  childPlan,
  ciContext,
  deploymentRequests,
  exitCodeOf,
  isStillActive,
  parseOutputEntries,
  previewTarget,
  redact,
  reporterArgs,
  supersededDeploymentIds,
} from './github-deployment-reporter.core.ts';

/** What the reporter did after the command exited. */
export type Report =
  | { readonly outcome: 'skipped'; readonly reason: string }
  | { readonly outcome: 'dry-run'; readonly requests: DeploymentRequests }
  | {
      readonly outcome: 'reported';
      readonly requests: DeploymentRequests;
      readonly deployment: { readonly id: number; readonly url: string };
      readonly deactivated: readonly number[];
      readonly warning: string | undefined;
    }
  | { readonly outcome: 'failed'; readonly reason: string };

/** The GitHub REST surface the reporter needs, injectable for tests. */
export type GitHubApi = {
  readonly token: string;
  readonly repository: string;
  readonly fetch: typeof globalThis.fetch;
};

const CreatedSchema = v.looseObject({ id: v.number(), url: v.string() });

type RequestBody =
  | DeploymentRequests['deployment']
  | DeploymentRequests['status']
  | typeof INACTIVE_STATUS;

/** One GitHub REST call: the body parsed with `schema`, or a throw on any non-2xx. */
const request = async <const Schema extends v.GenericSchema>(
  api: GitHubApi,
  method: 'GET' | 'POST',
  path: string,
  schema: Schema,
  body?: RequestBody,
): Promise<v.InferOutput<Schema>> => {
  const response = await api.fetch(
    `https://api.github.com/repos/${api.repository}${path}`,
    {
      method,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${api.token}`,
        'content-type': 'application/json',
        'user-agent': 'workers-builds-deployment-reporter',
        'x-github-api-version': '2022-11-28',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      // a hung API must not hold the deploy step open
      signal: AbortSignal.timeout(15_000),
    },
  );

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `${method} ${path}: HTTP ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  return v.parse(schema, JSON.parse(text));
};

const post = (
  api: GitHubApi,
  path: string,
  body: RequestBody,
): Promise<v.InferOutput<typeof CreatedSchema>> =>
  request(api, 'POST', path, CreatedSchema, body);

/** Creates the deployment and its success status; throws on any non-201. */
export const createDeployment = async (
  api: GitHubApi,
  requests: DeploymentRequests,
): Promise<{ id: number; url: string }> => {
  const { id, url } = await post(api, '/deployments', requests.deployment);
  await post(api, `/deployments/${id}/statuses`, requests.status);

  return { id, url };
};

/**
 * Marks the branch's earlier deployments in the environment inactive. Reads the
 * newest page only: older ones were superseded by pushes this already covered.
 */
export const deactivateSuperseded = async (
  api: GitHubApi,
  {
    environment,
    branch,
    keep,
  }: { environment: string; branch: string; keep: number },
): Promise<number[]> => {
  const listed = await request(
    api,
    'GET',
    `/deployments?environment=${encodeURIComponent(environment)}&per_page=100`,
    ListedDeploymentsSchema,
  );

  const deactivated: number[] = [];

  for (const id of supersededDeploymentIds(listed, branch, keep)) {
    const statuses = await request(
      api,
      'GET',
      `/deployments/${id}/statuses?per_page=1`,
      DeploymentStatusesSchema,
    );

    if (!isStillActive(statuses)) continue;

    await post(api, `/deployments/${id}/statuses`, INACTIVE_STATUS);
    deactivated.push(id);
  }

  return deactivated;
};

/** A snapshot of the output location, so only this run's entries are read. */
const snapshot = (source: OutputSource): (() => string) => {
  if (source.kind === 'file') {
    const offset = (() => {
      try {
        return statSync(source.path).size;
      } catch {
        return 0;
      }
    })();

    return () => {
      try {
        return readFileSync(source.path).subarray(offset).toString('utf8');
      } catch {
        return '';
      }
    };
  }

  const list = (): string[] => {
    try {
      return readdirSync(source.path);
    } catch {
      return [];
    }
  };

  const before = new Set(list());

  return () =>
    list()
      .filter(
        (name) => !before.has(name) && name.startsWith('wrangler-output-'),
      )
      .sort()
      .map((name) => readFileSync(join(source.path, name), 'utf8'))
      .join('\n');
};

/** Runs the command with inherited stdio and resolves with its shell-style exit code. */
export const runCommand = (
  [command, ...args]: readonly [string, ...string[]],
  env: Record<string, string>,
): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(command, args, { stdio: 'inherit', env });
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
    const forward = (signal: NodeJS.Signals) => child.kill(signal);

    for (const signal of signals) process.on(signal, forward);

    const done = (code: number) => {
      for (const signal of signals) process.off(signal, forward);
      resolve(code);
    };

    child.on('error', (error) => {
      console.error(`github-deployment-reporter: ${messageOf(error)}`);
      // the shell's code for a command that could not run
      done(127);
    });
    child.on('exit', (code, signal) => done(exitCodeOf(code, signal)));
  });

/** The report for a finished command; the only network call is `api.fetch`. */
export const report = async (
  {
    exitCode,
    output,
    env,
    dryRun,
  }: { exitCode: number; output: string; env: Env; dryRun: boolean },
  fetch: typeof globalThis.fetch = globalThis.fetch,
): Promise<Report> => {
  // the deploy's own check run reports a failure; a deployment without a URL shows nothing
  if (exitCode !== 0) {
    return { outcome: 'skipped', reason: `the command exited ${exitCode}` };
  }

  const token = env[TOKEN_ENV];

  if (!token && !dryRun) {
    return { outcome: 'skipped', reason: `${TOKEN_ENV} is not set` };
  }

  const target = previewTarget(parseOutputEntries(output));

  if (!target.ok) return { outcome: 'skipped', reason: target.reason };

  const ci = ciContext(env);

  if (!ci.ok) return { outcome: 'skipped', reason: ci.reason };

  const requests = deploymentRequests(target.target, ci.ci);

  if (dryRun || !token) return { outcome: 'dry-run', requests };

  const repository = env[REPOSITORY_ENV] || DEFAULT_REPOSITORY;

  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    return {
      outcome: 'skipped',
      reason: `${REPOSITORY_ENV} is not owner/name`,
    };
  }

  const api = { token, repository, fetch };
  const deployment = await createDeployment(api, requests);
  const branch = ci.ci.branch;

  if (branch === undefined) {
    return {
      outcome: 'reported',
      requests,
      deployment,
      deactivated: [],
      warning:
        'WORKERS_CI_BRANCH is not set, so no earlier deployment was retired',
    };
  }

  try {
    const deactivated = await deactivateSuperseded(api, {
      environment: requests.deployment.environment,
      branch,
      keep: deployment.id,
    });

    return {
      outcome: 'reported',
      requests,
      deployment,
      deactivated,
      warning: undefined,
    };
  } catch (error) {
    return {
      outcome: 'reported',
      requests,
      deployment,
      deactivated: [],
      warning: `retiring earlier deployments failed: ${redact(messageOf(error), [token])}`,
    };
  }
};

const describe = (result: Report): string => {
  if (result.outcome === 'skipped') return `skipped: ${result.reason}`;

  if (result.outcome === 'failed') {
    return `warning: not reported: ${result.reason}`;
  }

  if (result.outcome === 'dry-run') {
    return `dry run, would send:\n${JSON.stringify(result.requests, null, 2)}`;
  }

  const retired =
    result.deactivated.length > 0
      ? `; marked ${result.deactivated.join(', ')} inactive`
      : '';

  const warning = result.warning ? `\nwarning: ${result.warning}` : '';

  return `created deployment ${result.deployment.id} for ${result.requests.deployment.environment}: ${result.requests.status.environment_url}${retired}${warning}`;
};

const main = async (argv: string[]): Promise<void> => {
  const parsed = reporterArgs(argv);

  if (!parsed.ok) {
    console.error(`github-deployment-reporter: ${parsed.error}\n${USAGE}`);
    process.exitCode = 2;

    return;
  }

  const { dryRun, flags, command } = parsed.args;

  const unknown = flags.filter(
    (flag, index) =>
      flag !== '--json' &&
      flag !== '--json-out' &&
      flags[index - 1] !== '--json-out',
  );

  let output;

  try {
    if (unknown.length > 0)
      throw new Error(`unknown argument(s): ${unknown.join(' ')}`);
    output = jsonOutput(flags);
  } catch (error) {
    console.error(`github-deployment-reporter: ${messageOf(error)}\n${USAGE}`);
    process.exitCode = 2;

    return;
  }

  // wrangler creates the file and its directory, so nothing here can fail before the deploy
  const temp = join(
    tmpdir(),
    `github-deployment-reporter-${process.pid}-${Date.now()}.ndjson`,
  );

  const plan = childPlan(process.env, temp);
  const read = snapshot(plan.source);
  const exitCode = await runCommand(command, plan.env);

  // the deploy's status is settled; nothing below may change it
  process.exitCode = exitCode;

  let result: Report;

  try {
    result = await report({
      exitCode,
      output: read(),
      env: process.env,
      dryRun,
    });
  } catch (error) {
    result = {
      outcome: 'failed',
      reason: redact(messageOf(error), [process.env[TOKEN_ENV]]),
    };
  }

  if (plan.source.kind === 'file' && plan.source.owned)
    rmSync(temp, { force: true });

  // stderr, so `--json` owns stdout
  console.error(`github-deployment-reporter: ${describe(result)}`);

  try {
    await writeJsonOutput(output, `${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    console.warn(`github-deployment-reporter: warning: ${messageOf(error)}`);
  }
};

if (import.meta.main) await main(process.argv.slice(2));
