#!/usr/bin/env node
// Surfaces Workers Builds preview URLs as GitHub Deployments, one
// `preview/<worker>` environment per Worker, and reads them back.
//
// Usage:
//   preview-deployment.ts post (--details-url <url> | --worker <name> --build <uuid>)
//                              [--sha <sha>] [--dry-run] [--json | --json-out <path>]
//   preview-deployment.ts read (--pr <number> | --sha <sha>) [--json | --json-out <path>]
//
// `post` needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (Workers Builds
// and Workers Scripts read), and gh authenticated with deployments write
// unless --dry-run. `read` needs gh only. GITHUB_REPOSITORY picks the repo.
// Exit codes: 0 posted, skipped or read; 1 an API failure; 2 a usage error.
// All decisions live in preview-deployment.core.ts.

import { parseArgs } from 'node:util';

import { listBetaWorkerVersions } from '@distilled.cloud/cloudflare/workers';
import {
  getBuild,
  getBuildsByVersion,
} from '@distilled.cloud/cloudflare/workers_builds';
import {
  type JsonOutput,
  jsonOutput,
  withoutJsonFlags,
  writeJsonOutput,
} from '@tools/cli/json-output.ts';
import { type CloudflareApi, call } from '@tools/cloudflare-api/call.ts';
import { messageOf } from '@tools/shared/errors.ts';
import { type Exec, defaultExec } from '@tools/shared/exec.ts';
import { ensureGh } from '@tools/shared/gh.ts';

import { isCommitSha } from './pages-deploy.core.ts';
import {
  type BuildRef,
  type Preview,
  type PreviewRecord,
  type Skip,
  type Version,
  buildFromApi,
  buildsByVersionFromApi,
  candidateVersions,
  createDeploymentArgs,
  createStatusArgs,
  deploymentFromApi,
  deploymentsFromApi,
  existingDeployment,
  isUuid,
  latestPreviewDeployments,
  latestStatusArgs,
  listDeploymentsArgs,
  pageReachesBefore,
  parseDetailsUrl,
  prHeadArgs,
  previewFor,
  previewRecord,
  recordsText,
  versionsFromApi,
} from './preview-deployment.core.ts';

const USAGE = `usage:
  preview-deployment.ts post (--details-url <url> | --worker <name> --build <uuid>) [--sha <sha>] [--dry-run] [--json]
  preview-deployment.ts read (--pr <number> | --sha <sha>) [--json]`;

const DEFAULT_REPO = 'simshanith/lit-ui-router';

/** Newest-first pages scanned for the build's version before giving up. */
const MAX_VERSION_PAGES = 5;

const VERSIONS_PER_PAGE = 50;

/** The dashboard URL for a build, as the Cloudflare check run links it. */
const buildLogUrl = (accountId: string, ref: BuildRef): string =>
  `https://dash.cloudflare.com/${accountId}/workers/services/view/${ref.worker}/production/builds/${ref.buildUuid}`;

/** The build and the Worker versions it could have uploaded, with their builds. */
export async function resolvePreview(
  api: CloudflareApi,
  ref: BuildRef,
  logUrl: string,
): Promise<Preview | Skip> {
  const build = buildFromApi(
    await call(
      api,
      `GET /{account_id}/builds/builds/${ref.buildUuid}`,
      getBuild({ accountId: api.accountId, buildUuid: ref.buildUuid }),
    ),
  );

  const versions: Version[] = [];

  for (let page = 1; page <= MAX_VERSION_PAGES; page += 1) {
    const { result } = await call(
      api,
      `GET /{account_id}/workers/workers/${ref.worker}/versions?page=${page}`,
      listBetaWorkerVersions({
        accountId: api.accountId,
        workerId: ref.worker,
        page,
        perPage: VERSIONS_PER_PAGE,
      }),
    );

    const listed = versionsFromApi(result);

    versions.push(...listed);

    if (listed.length < VERSIONS_PER_PAGE || pageReachesBefore(listed, build))
      break;
  }

  const candidates = candidateVersions(versions, build);

  const buildsByVersion =
    candidates.length === 0
      ? new Map<string, string>()
      : buildsByVersionFromApi(
          await call(
            api,
            'GET /{account_id}/builds/builds?version_ids=…',
            getBuildsByVersion({
              accountId: api.accountId,
              versionIds: candidates.map((version) => version.id).join(','),
            }),
          ),
        );

  return previewFor({
    ref,
    build,
    versions: candidates,
    buildsByVersion,
    logUrl,
  });
}

type PostResult =
  | (Skip & { readonly ref: BuildRef })
  | {
      readonly preview: Preview;
      readonly dryRun: boolean;
      readonly deployment: string[];
      readonly status: string[];
      readonly deploymentId: number | null;
      readonly existing: boolean;
    };

/** Creates the deployment and its success status, unless this build has one. */
async function postPreview(
  exec: Exec,
  repo: string,
  preview: Preview,
): Promise<{ id: number; existing: boolean }> {
  await ensureGh(exec);

  const listed = await exec(
    'gh',
    listDeploymentsArgs(repo, preview.sha, preview.environment),
  );

  const found = existingDeployment(deploymentsFromApi(listed.stdout), preview);

  if (found !== undefined) return { id: found.id, existing: true };

  const created = await exec('gh', createDeploymentArgs(repo, preview));
  const { id } = deploymentFromApi(created.stdout);

  await exec('gh', createStatusArgs(repo, id, preview));

  return { id, existing: false };
}

const postText = (result: PostResult): string => {
  if ('skip' in result) {
    return `no deployment for ${result.ref.worker} build ${result.ref.buildUuid}: ${result.skip}`;
  }

  const { preview } = result;

  const lines = [
    `${preview.environment} on ${preview.sha}`,
    `  commit preview: ${preview.commitUrl}`,
    `  branch alias:   ${preview.branchUrl ?? '(none)'}`,
    `  version:        ${preview.versionId}`,
    `  log:            ${preview.logUrl}`,
  ];

  if (result.dryRun) {
    lines.push(
      'dry run, would post:',
      `  gh ${result.deployment.join(' ')}`,
      `  gh ${result.status.join(' ')}`,
    );
  } else {
    lines.push(
      result.existing
        ? `deployment ${result.deploymentId} already posted for this build`
        : `created deployment ${result.deploymentId} with a success status`,
    );
  }

  return lines.join('\n');
};

/** A bad invocation: main prints the usage and exits 2. */
class UsageError extends Error {}

/** node:util parseArgs rejects unknown or malformed flags with an ERR_PARSE_ARGS_* code. */
const isParseArgsError = (error: unknown): error is Error =>
  error instanceof TypeError &&
  'code' in error &&
  String(error.code).startsWith('ERR_PARSE_ARGS_');

const commitSha = (sha: string | undefined): string | undefined => {
  if (sha !== undefined && !isCommitSha(sha)) {
    throw new UsageError(`not a full commit sha: ${sha}`);
  }

  return sha;
};

/** The `post` flags as a build reference. */
const buildRefFrom = (values: {
  'details-url'?: string;
  worker?: string;
  build?: string;
}): BuildRef => {
  const detailsUrl = values['details-url'];

  if (detailsUrl !== undefined) {
    const ref = parseDetailsUrl(detailsUrl);

    if (ref === undefined) {
      throw new UsageError(`not a Workers Builds build URL: ${detailsUrl}`);
    }

    return ref;
  }

  if (values.worker === undefined || values.build === undefined) {
    throw new UsageError('pass --details-url, or --worker with --build');
  }

  if (!isUuid(values.build)) {
    throw new UsageError(`not a build UUID: ${values.build}`);
  }

  return { worker: values.worker, buildUuid: values.build };
};

const cloudflareApi = (): CloudflareApi => {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

  if (!token || !accountId) {
    throw new UsageError(
      'set CLOUDFLARE_API_TOKEN (Workers Builds and Workers Scripts read) and CLOUDFLARE_ACCOUNT_ID',
    );
  }

  return { token, accountId, fetch: globalThis.fetch };
};

const post = async (args: string[], repo: string): Promise<PostResult> => {
  const { values } = parseArgs({
    args,
    options: {
      'details-url': { type: 'string' },
      worker: { type: 'string' },
      build: { type: 'string' },
      sha: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: true,
  });

  const ref = buildRefFrom(values);
  const sha = commitSha(values.sha);
  const api = cloudflareApi();
  const logUrl = values['details-url'] ?? buildLogUrl(api.accountId, ref);
  const resolved = await resolvePreview(api, ref, logUrl);

  if ('skip' in resolved) return { ...resolved, ref };

  // The check run's head_sha and the build's commit must agree, or the URL lands on the wrong commit.
  if (sha !== undefined && sha !== resolved.sha) {
    throw new Error(
      `build ${ref.buildUuid} built ${resolved.sha}, not --sha ${sha}`,
    );
  }

  const dryRun = values['dry-run'];

  const posted = dryRun
    ? undefined
    : await postPreview(defaultExec, repo, resolved);

  return {
    preview: resolved,
    dryRun,
    deployment: createDeploymentArgs(repo, resolved),
    status: createStatusArgs(repo, posted?.id ?? '{id}', resolved),
    deploymentId: posted?.id ?? null,
    existing: posted?.existing ?? false,
  };
};

type ReadResult = {
  readonly sha: string;
  readonly previews: readonly PreviewRecord[];
};

const prNumber = (pr: string | undefined): number | undefined => {
  if (pr === undefined) return undefined;

  const number = Number(pr);

  if (!Number.isInteger(number) || number <= 0) {
    throw new UsageError(`not a PR number: ${pr}`);
  }

  return number;
};

const read = async (args: string[], repo: string): Promise<ReadResult> => {
  const { values } = parseArgs({
    args,
    options: { pr: { type: 'string' }, sha: { type: 'string' } },
    strict: true,
  });

  const pr = prNumber(values.pr);
  const given = commitSha(values.sha);

  if ((pr === undefined) === (given === undefined)) {
    throw new UsageError('pass one of --pr or --sha');
  }

  await ensureGh();

  const sha =
    given ?? (await defaultExec('gh', prHeadArgs(repo, pr ?? 0))).stdout.trim();

  const { stdout } = await defaultExec('gh', listDeploymentsArgs(repo, sha));

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

const outputFrom = (argv: string[]): JsonOutput => {
  try {
    return jsonOutput(argv);
  } catch (error: unknown) {
    throw new UsageError(messageOf(error));
  }
};

const run = async (argv: string[]): Promise<void> => {
  const output = outputFrom(argv);
  const [command, ...args] = withoutJsonFlags(argv);
  const repo = process.env.GITHUB_REPOSITORY ?? DEFAULT_REPO;

  if (command === 'post') {
    const result = await post(args, repo);

    if (output.kind !== 'stdout') console.log(postText(result));

    await writeJsonOutput(output, `${JSON.stringify(result, null, 2)}\n`);

    return;
  }

  if (command === 'read') {
    const result = await read(args, repo);

    if (output.kind !== 'stdout') {
      console.log(recordsText(result.sha, result.previews));
    }

    await writeJsonOutput(output, `${JSON.stringify(result, null, 2)}\n`);

    return;
  }

  throw new UsageError(`unknown command: ${command ?? '(none)'}`);
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
