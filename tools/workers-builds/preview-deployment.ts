#!/usr/bin/env node
// Surfaces Workers Builds preview URLs as GitHub Deployments, one
// `preview/<worker>` environment per Worker, retires them, and reads them back.
//
// Usage:
//   preview-deployment.ts post (--check-run <id> | --name <check run name> --sha <sha>
//                               --branch <branch> --summary <text> --details-url <url>)
//                              [--dry-run] [--json | --json-out <path>]
//   preview-deployment.ts retire --branch <branch> [--dry-run] [--json | --json-out <path>]
//   preview-deployment.ts read (--pr <number> | --sha <sha>) [--json | --json-out <path>]
//
// Every command talks to GitHub only, through gh: deployments write for post
// and retire, read for the rest and for --dry-run. GITHUB_REPOSITORY picks the repo.
// Exit codes: 0 posted, skipped, retired or read; 1 a failure; 2 a usage error.
// All decisions live in preview-deployment.core.ts.

import { parseArgs } from 'node:util';

import {
  type JsonOutput,
  jsonOutput,
  withoutJsonFlags,
  writeJsonOutput,
} from '@tools/cli/json-output.ts';
import { messageOf } from '@tools/shared/errors.ts';
import { type Exec, defaultCapture, defaultExec } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';

import { isCommitSha } from './pages-deploy.core.ts';
import {
  type CheckRun,
  type GitHubDeployment,
  type Preview,
  type PreviewRecord,
  type Skip,
  branchDeployments,
  checkRunArgs,
  checkRunFromApi,
  checkRunOf,
  checkSuiteBranchArgs,
  createDeploymentArgs,
  createStatusArgs,
  deploymentFromApi,
  deploymentPagesFromApi,
  deploymentsFromApi,
  environmentDeploymentsArgs,
  environmentsArgs,
  existingDeployment,
  inactiveStatusArgs,
  latestPreviewDeployments,
  latestStatusArgs,
  listDeploymentsArgs,
  needsInactive,
  prHeadArgs,
  previewEnvironments,
  previewFromCheckRun,
  previewRecord,
  recordsText,
  supersededDeployments,
} from './preview-deployment.core.ts';

const USAGE = `usage:
  preview-deployment.ts post (--check-run <id> | --name <name> --sha <sha> --branch <branch> --summary <text> --details-url <url>) [--dry-run] [--json]
  preview-deployment.ts retire --branch <branch> [--dry-run] [--json]
  preview-deployment.ts read (--pr <number> | --sha <sha>) [--json]`;

const DEFAULT_REPO = 'simshanith/lit-ui-router';

/** A bad invocation: main prints the usage and exits 2. */
class UsageError extends Error {}

/** node:util parseArgs rejects unknown or malformed flags with an ERR_PARSE_ARGS_* code. */
const isParseArgsError = (error: unknown): error is Error =>
  error instanceof TypeError &&
  'code' in error &&
  String(error.code).startsWith('ERR_PARSE_ARGS_');

const positiveInteger = (value: string, what: string): number => {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new UsageError(`not a ${what}: ${value}`);
  }

  return number;
};

/** The active ones among `deployments`, each marked inactive unless `dryRun`. */
async function deactivate(
  exec: Exec,
  repo: string,
  deployments: readonly GitHubDeployment[],
  description: string,
  dryRun: boolean,
): Promise<number[]> {
  const deactivated: number[] = [];

  for (const deployment of deployments) {
    const statuses = await exec('gh', latestStatusArgs(repo, deployment.id));

    if (!needsInactive(statuses.stdout)) continue;

    if (!dryRun) {
      await exec('gh', inactiveStatusArgs(repo, deployment.id, description));
    }

    deactivated.push(deployment.id);
  }

  return deactivated;
}

type Posted = {
  readonly id: number | null;
  readonly existing: boolean;
  readonly deactivated: readonly number[];
};

/**
 * Creates the deployment and its success status unless this build has one,
 * then retires the branch's older ones. A dry run creates nothing and lists
 * the branch's active deployments it would retire.
 */
async function postPreview(
  exec: Exec,
  repo: string,
  preview: Preview,
  dryRun: boolean,
): Promise<Posted> {
  const listed = await environmentDeployments(exec, repo, preview.environment);
  const found = existingDeployment(listed, preview);
  let current = found;

  if (current === undefined && !dryRun) {
    const created = await exec('gh', createDeploymentArgs(repo, preview));

    current = deploymentFromApi(created.stdout);
    await exec('gh', createStatusArgs(repo, current.id, preview));
  }

  // A dry run's deployment would be the newest, so every listed one of the branch is older.
  const older =
    current === undefined
      ? branchDeployments(listed, preview.branch)
      : supersededDeployments(listed, current, preview.branch);

  return {
    id: current?.id ?? null,
    existing: found !== undefined,
    deactivated: await deactivate(
      exec,
      repo,
      older,
      `Superseded by ${preview.sha.slice(0, 8)}`,
      dryRun,
    ),
  };
}

/** Every deployment in `environment`, all pages, read with no output ceiling. */
async function environmentDeployments(
  exec: Exec,
  repo: string,
  environment: string,
): Promise<GitHubDeployment[]> {
  const pages = await exec('gh', environmentDeploymentsArgs(repo, environment));

  return deploymentPagesFromApi(pages.stdout);
}

/** The `post` flags as a check run: fetched by id, or as the workflow passes the event's fields. */
async function checkRunFrom(
  values: {
    'check-run'?: string;
    name?: string;
    sha?: string;
    branch?: string;
    summary?: string;
    'details-url'?: string;
  },
  repo: string,
): Promise<CheckRun> {
  if (values['check-run'] !== undefined) {
    const id = positiveInteger(values['check-run'], 'check run id');

    const run = checkRunFromApi(
      (await defaultExec('gh', checkRunArgs(repo, id))).stdout,
    );

    const branch = await defaultExec(
      'gh',
      checkSuiteBranchArgs(repo, run.check_suite.id),
    );

    return checkRunOf(run, branch.stdout.trim());
  }

  const { name, sha, branch, summary } = values;
  const detailsUrl = values['details-url'];

  if (
    name === undefined ||
    sha === undefined ||
    branch === undefined ||
    summary === undefined ||
    detailsUrl === undefined
  ) {
    throw new UsageError(
      'pass --check-run, or all of --name, --sha, --branch, --summary and --details-url',
    );
  }

  return { name, headSha: sha, headBranch: branch, summary, detailsUrl };
}

type PostResult =
  | Skip
  | ({ readonly preview: Preview; readonly dryRun: boolean } & Posted);

const post = async (args: string[], repo: string): Promise<PostResult> => {
  const { values } = parseArgs({
    args,
    options: {
      'check-run': { type: 'string' },
      name: { type: 'string' },
      sha: { type: 'string' },
      branch: { type: 'string' },
      summary: { type: 'string' },
      'details-url': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: true,
  });

  await ensureGh();

  const preview = previewFromCheckRun(await checkRunFrom(values, repo));

  if ('skip' in preview) return preview;

  const dryRun = values['dry-run'];
  const posted = await postPreview(defaultCapture, repo, preview, dryRun);

  return { preview, dryRun, ...posted };
};

const postText = (result: PostResult): string => {
  if ('skip' in result) {
    return `no deployment for ${result.worker}: ${result.skip}`;
  }

  const { preview } = result;

  const retired =
    result.deactivated.length === 0 ? 'none' : result.deactivated.join(', ');

  return [
    `${preview.environment} on ${preview.sha} (${preview.branch})`,
    `  commit preview: ${preview.commitUrl}`,
    `  branch alias:   ${preview.branchUrl ?? '(none)'}`,
    `  version:        ${preview.versionId}`,
    `  log:            ${preview.logUrl}`,
    result.dryRun
      ? `dry run: would ${result.existing ? `keep deployment ${result.id}` : 'create a deployment with a success status'}, then retire: ${retired}`
      : `${result.existing ? 'kept' : 'created'} deployment ${result.id}; retired: ${retired}`,
  ].join('\n');
};

type RetireResult = {
  readonly branch: string;
  readonly dryRun: boolean;
  readonly deactivated: readonly number[];
};

const retire = async (args: string[], repo: string): Promise<RetireResult> => {
  const { values } = parseArgs({
    args,
    options: {
      branch: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: true,
  });

  const { branch } = values;

  if (branch === undefined || branch === '') {
    throw new UsageError('pass --branch');
  }

  await ensureGh();

  const environments = previewEnvironments(
    (await defaultExec('gh', environmentsArgs(repo))).stdout,
  );

  const deployments: GitHubDeployment[] = [];

  for (const environment of environments) {
    deployments.push(
      ...(await environmentDeployments(defaultCapture, repo, environment)),
    );
  }

  const dryRun = values['dry-run'];

  const deactivated = await deactivate(
    defaultExec,
    repo,
    branchDeployments(deployments, branch),
    'Pull request closed',
    dryRun,
  );

  return { branch, dryRun, deactivated };
};

const retireText = ({ branch, dryRun, deactivated }: RetireResult): string =>
  deactivated.length === 0
    ? `no active preview deployment on ${branch}`
    : `${dryRun ? 'would mark' : 'marked'} inactive on ${branch}: ${deactivated.join(', ')}`;

type ReadResult = {
  readonly sha: string;
  readonly previews: readonly PreviewRecord[];
};

const read = async (args: string[], repo: string): Promise<ReadResult> => {
  const { values } = parseArgs({
    args,
    options: { pr: { type: 'string' }, sha: { type: 'string' } },
    strict: true,
  });

  if ((values.pr === undefined) === (values.sha === undefined)) {
    throw new UsageError('pass one of --pr or --sha');
  }

  if (values.sha !== undefined && !isCommitSha(values.sha)) {
    throw new UsageError(`not a full commit sha: ${values.sha}`);
  }

  await ensureGh();

  const sha =
    values.sha ??
    (
      await defaultExec(
        'gh',
        prHeadArgs(repo, positiveInteger(values.pr ?? '', 'PR number')),
      )
    ).stdout.trim();

  const { stdout } = await defaultExec(
    'gh',
    listDeploymentsArgs(repo, { sha }),
  );

  const previews = await Promise.all(
    latestPreviewDeployments(deploymentsFromApi(stdout)).map(
      async (deployment) => {
        const statuses = await defaultExec(
          'gh',
          latestStatusArgs(repo, deployment.id),
        );

        return previewRecord(deployment, statuses.stdout);
      },
    ),
  );

  return { sha, previews };
};

const COMMANDS = {
  post: { run: post, text: postText },
  retire: { run: retire, text: retireText },
  read: {
    run: read,
    text: (result: ReadResult) => recordsText(result.sha, result.previews),
  },
} as const;

const outputFrom = (argv: string[]): JsonOutput => {
  try {
    return jsonOutput(argv);
  } catch (error: unknown) {
    throw new UsageError(messageOf(error));
  }
};

/** Runs one command, printing text unless its JSON goes to stdout. */
async function runCommand<R>(
  command: {
    run: (args: string[], repo: string) => Promise<R>;
    text: (result: R) => string;
  },
  args: string[],
  output: JsonOutput,
): Promise<void> {
  const result = await command.run(
    args,
    process.env.GITHUB_REPOSITORY ?? DEFAULT_REPO,
  );

  if (output.kind !== 'stdout') console.log(command.text(result));

  await writeJsonOutput(output, `${JSON.stringify(result, null, 2)}\n`);
}

const run = async (argv: string[]): Promise<void> => {
  const output = outputFrom(argv);
  const [name, ...args] = withoutJsonFlags(argv);

  if (name === 'post') return runCommand(COMMANDS.post, args, output);

  if (name === 'retire') return runCommand(COMMANDS.retire, args, output);

  if (name === 'read') return runCommand(COMMANDS.read, args, output);

  throw new UsageError(`unknown command: ${name ?? '(none)'}`);
};

const main = async (argv: string[]): Promise<void> => {
  try {
    await run(argv);
  } catch (error: unknown) {
    const usage = error instanceof UsageError || isParseArgsError(error);

    console.error(`preview-deployment: ${messageOf(error)}`);

    if (usage) console.error(USAGE);

    process.exitCode = usage ? 2 : 1;
  }
};

if (import.meta.main) await main(process.argv.slice(2));
