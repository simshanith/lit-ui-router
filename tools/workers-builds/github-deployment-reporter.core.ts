// Pure logic for github-deployment-reporter.ts; no process, file or network access here.

import { constants } from 'node:os';

import * as v from 'valibot';

/** The env var holding the GitHub token; it never reaches the wrapped command. */
export const TOKEN_ENV = 'GITHUB_DEPLOYMENTS_TOKEN';

/** Overrides the repository the deployments land in, as `owner/name`. */
export const REPOSITORY_ENV = 'GITHUB_DEPLOYMENTS_REPOSITORY';

export const DEFAULT_REPOSITORY = 'simshanith/lit-ui-router';

// Both wrangler and cf read these (workers-utils' writeOutput); PATH wins over DIRECTORY.
export const OUTPUT_PATH_ENV = 'WRANGLER_OUTPUT_FILE_PATH';

export const OUTPUT_DIRECTORY_ENV = 'WRANGLER_OUTPUT_FILE_DIRECTORY';

/** The environment prefix; the worker name follows, as in the Actions-side reporter. */
export const ENVIRONMENT_PREFIX = 'preview/';

export type Env = Readonly<Record<string, string | undefined>>;

/** Where the wrapped command's NDJSON lands. */
export type OutputSource =
  | { readonly kind: 'file'; readonly path: string; readonly owned: boolean }
  | { readonly kind: 'directory'; readonly path: string };

/** The wrapped command's environment, and where its output lands. */
export type ChildPlan = {
  readonly env: Record<string, string>;
  readonly source: OutputSource;
};

/**
 * The child's environment and where its output lands. An output location the
 * caller already set (Workers Builds reads it for its own PR comment) is kept,
 * so the reporter reads alongside rather than diverting it.
 */
export const childPlan = (env: Env, tempPath: string): ChildPlan => {
  const childEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (key !== TOKEN_ENV && value !== undefined) childEnv[key] = value;
  }

  const path = env[OUTPUT_PATH_ENV];

  if (path)
    return { env: childEnv, source: { kind: 'file', path, owned: false } };

  const directory = env[OUTPUT_DIRECTORY_ENV];

  if (directory) {
    return { env: childEnv, source: { kind: 'directory', path: directory } };
  }

  childEnv[OUTPUT_PATH_ENV] = tempPath;

  return {
    env: childEnv,
    source: { kind: 'file', path: tempPath, owned: true },
  };
};

/** The wrapped command's exit status as a shell reports it: a signal is 128 + its number. */
export const exitCodeOf = (
  code: number | null,
  signal: NodeJS.Signals | null,
): number => {
  if (code !== null) return code;

  return 128 + (signal ? (constants.signals[signal] ?? 0) : 0);
};

// GitHub's token prefixes, scrubbed even when the value itself was not passed in.
const GITHUB_TOKEN_PATTERN =
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g;

/** `text` with every secret, and anything shaped like a GitHub token, replaced. */
export const redact = (
  text: string,
  secrets: readonly (string | undefined)[],
): string => {
  let scrubbed = text;

  for (const secret of secrets) {
    if (secret) scrubbed = scrubbed.replaceAll(secret, '***');
  }

  return scrubbed.replace(GITHUB_TOKEN_PATTERN, '***');
};

/** The reporter's own flags, and the command after `--`. */
export type ReporterArgs = {
  readonly dryRun: boolean;
  readonly flags: readonly string[];
  readonly command: readonly [string, ...string[]];
};

export const USAGE =
  'usage: github-deployment-reporter.ts [--dry-run] [--json | --json-out <path>] -- <command> [args...]';

/** Splits argv at the first `--`; everything after it is the wrapped command, verbatim. */
export const reporterArgs = (
  argv: readonly string[],
): { ok: true; args: ReporterArgs } | { ok: false; error: string } => {
  const separator = argv.indexOf('--');
  const [head, ...tail] = separator === -1 ? [] : argv.slice(separator + 1);

  if (head === undefined) {
    return { ok: false, error: 'missing `-- <command>`' };
  }

  const own = argv.slice(0, separator);
  const flags = own.filter((arg) => arg !== '--dry-run');

  return {
    ok: true,
    args: {
      dryRun: own.includes('--dry-run'),
      flags,
      command: [head, ...tail],
    },
  };
};

const url = v.pipe(v.string(), v.url());

// looseObject: each entry carries more than the reporter reads (bundle size, timestamps).
const VersionUploadSchema = v.looseObject({
  type: v.literal('version-upload'),
  worker_name: v.nullish(v.string()),
  version_id: v.nullish(v.string()),
  preview_url: v.nullish(url),
  preview_alias_url: v.nullish(url),
});

const PreviewSchema = v.looseObject({
  type: v.literal('preview'),
  worker_name: v.nullish(v.string()),
  preview_slug: v.nullish(v.string()),
  preview_urls: v.nullish(v.array(url)),
  deployment_id: v.nullish(v.string()),
  deployment_urls: v.nullish(v.array(url)),
});

const EntrySchema = v.variant('type', [VersionUploadSchema, PreviewSchema]);

export type OutputEntry = v.InferOutput<typeof EntrySchema>;

/**
 * The preview-bearing entries of a wrangler/cf output file; other entry types
 * (session, deploy, command-failed) are skipped. Throws on a line that is not JSON
 * or a preview entry that fails validation.
 */
export const parseOutputEntries = (ndjson: string): OutputEntry[] => {
  const entries: OutputEntry[] = [];

  for (const [index, line] of ndjson.split('\n').entries()) {
    if (line.trim() === '') continue;

    const json: unknown = JSON.parse(line);

    if (
      !v.is(
        v.looseObject({ type: v.picklist(['version-upload', 'preview']) }),
        json,
      )
    ) {
      continue;
    }

    const parsed = v.safeParse(EntrySchema, json);

    if (!parsed.success) {
      const details = parsed.issues
        .map((issue) => `${v.getDotPath(issue) ?? ''}: ${issue.message}`)
        .join('; ');

      throw new Error(`output line ${index + 1}: ${details}`);
    }

    entries.push(parsed.output);
  }

  return entries;
};

/** What a deployment points at: the commit's own URL, plus the branch-stable one. */
export type PreviewTarget = {
  readonly kind: OutputEntry['type'];
  readonly worker: string;
  readonly url: string;
  readonly aliasUrl: string | undefined;
  readonly id: string | undefined;
};

/** The last preview-bearing entry with a worker name and a URL, or why there is none. */
export const previewTarget = (
  entries: readonly OutputEntry[],
): { ok: true; target: PreviewTarget } | { ok: false; reason: string } => {
  const entry = entries.at(-1);

  if (entry === undefined) {
    return {
      ok: false,
      reason: 'no version-upload or preview entry in the output',
    };
  }

  if (!entry.worker_name) {
    return { ok: false, reason: `the ${entry.type} entry names no worker` };
  }

  const target =
    entry.type === 'version-upload'
      ? {
          url: entry.preview_url,
          aliasUrl: entry.preview_alias_url ?? undefined,
          id: entry.version_id ?? undefined,
        }
      : {
          url: entry.deployment_urls?.[0] ?? entry.preview_urls?.[0],
          aliasUrl: entry.preview_urls?.[0],
          id: entry.deployment_id ?? undefined,
        };

  if (!target.url) {
    return {
      ok: false,
      reason: `the ${entry.type} entry has no preview URL (preview_urls off?)`,
    };
  }

  return {
    ok: true,
    target: {
      kind: entry.type,
      worker: entry.worker_name,
      ...target,
      url: target.url,
    },
  };
};

const CiSchema = v.object({
  WORKERS_CI_COMMIT_SHA: v.pipe(
    v.string(),
    v.regex(/^[0-9a-f]{40}$/, 'not a full commit sha'),
  ),
  WORKERS_CI_BRANCH: v.optional(v.string()),
  WORKERS_CI_BUILD_UUID: v.optional(v.pipe(v.string(), v.uuid())),
});

/** The Workers Builds context the deployment records; see the default build variables. */
export type CiContext = {
  readonly sha: string;
  readonly branch: string | undefined;
  readonly buildUuid: string | undefined;
};

export const ciContext = (
  env: Env,
): { ok: true; ci: CiContext } | { ok: false; reason: string } => {
  const parsed = v.safeParse(CiSchema, {
    WORKERS_CI_COMMIT_SHA: env.WORKERS_CI_COMMIT_SHA,
    WORKERS_CI_BRANCH: env.WORKERS_CI_BRANCH || undefined,
    WORKERS_CI_BUILD_UUID: env.WORKERS_CI_BUILD_UUID || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      reason: parsed.issues
        .map((issue) => `${v.getDotPath(issue) ?? ''}: ${issue.message}`)
        .join('; '),
    };
  }

  const { WORKERS_CI_COMMIT_SHA, WORKERS_CI_BRANCH, WORKERS_CI_BUILD_UUID } =
    parsed.output;

  return {
    ok: true,
    ci: {
      sha: WORKERS_CI_COMMIT_SHA,
      branch: WORKERS_CI_BRANCH,
      buildUuid: WORKERS_CI_BUILD_UUID,
    },
  };
};

/** The body of POST /repos/{owner}/{repo}/deployments. */
export type DeploymentBody = {
  readonly ref: string;
  readonly environment: string;
  readonly auto_merge: false;
  readonly required_contexts: readonly string[];
  readonly transient_environment: true;
  readonly production_environment: false;
  readonly description: string;
  readonly payload: {
    readonly worker: string;
    readonly kind: PreviewTarget['kind'];
    readonly id: string | null;
    readonly branch: string | null;
    readonly alias_url: string | null;
    readonly build_uuid: string | null;
  };
};

/** The body of POST /repos/{owner}/{repo}/deployments/{id}/statuses; JSON drops an undefined `log_url`. */
export type StatusBody = {
  readonly state: 'success';
  readonly environment_url: string;
  readonly log_url: string | undefined;
  readonly auto_inactive: true;
  readonly description: string;
};

/** The two GitHub requests: create the deployment, then mark it successful. */
export type DeploymentRequests = {
  readonly deployment: DeploymentBody;
  readonly status: StatusBody;
};

// GitHub caps a status description at 140 characters; a cut URL is worse than none.
const statusDescription = (target: PreviewTarget): string => {
  const alias = `Branch preview: ${target.aliasUrl ?? ''}`;

  return target.aliasUrl && alias.length <= 140
    ? alias
    : `Commit preview of ${target.worker}`.slice(0, 140);
};

// The dashboard's `:account` placeholder resolves to the viewer's account, so no ID is written.
const buildLogUrl = (worker: string, buildUuid: string): string =>
  `https://dash.cloudflare.com/?to=/:account/workers/services/view/${encodeURIComponent(worker)}/production/builds/${buildUuid}`;

export const deploymentRequests = (
  target: PreviewTarget,
  ci: CiContext,
): DeploymentRequests => ({
  deployment: {
    ref: ci.sha,
    environment: `${ENVIRONMENT_PREFIX}${target.worker}`,
    // the default merges main into the branch and answers 202 instead of deploying
    auto_merge: false,
    required_contexts: [],
    transient_environment: true,
    production_environment: false,
    description: `Workers Builds ${target.kind} of ${target.worker}`,
    payload: {
      worker: target.worker,
      kind: target.kind,
      id: target.id ?? null,
      branch: ci.branch ?? null,
      alias_url: target.aliasUrl ?? null,
      build_uuid: ci.buildUuid ?? null,
    },
  },
  status: {
    state: 'success',
    environment_url: target.url,
    log_url: ci.buildUuid
      ? buildLogUrl(target.worker, ci.buildUuid)
      : undefined,
    auto_inactive: true,
    description: statusDescription(target),
  },
});

// fallback: a payload this reporter did not write (a string, another tool's shape) matches no branch.
export const ListedDeploymentsSchema = v.array(
  v.looseObject({
    id: v.number(),
    created_at: v.pipe(v.string(), v.isoTimestamp()),
    payload: v.fallback(v.looseObject({ branch: v.nullish(v.string()) }), {
      branch: null,
    }),
  }),
);

export type ListedDeployments = v.InferOutput<typeof ListedDeploymentsSchema>;

/** GET …/deployments/{id}/statuses, newest first. */
export const DeploymentStatusesSchema = v.array(
  v.looseObject({ state: v.string() }),
);

export type DeploymentStatuses = v.InferOutput<typeof DeploymentStatusesSchema>;

/**
 * The deployments a new one supersedes: same branch in its payload, created before it.
 * The environment is shared by every PR, and a transient one never triggers `auto_inactive`.
 * A late or rerun report must not retire a newer push, and one missing from the listing retires nothing.
 */
export const supersededDeploymentIds = (
  listed: ListedDeployments,
  branch: string,
  current: number,
): number[] => {
  const posted = listed.find((deployment) => deployment.id === current);

  if (posted === undefined) return [];

  const before = Date.parse(posted.created_at);

  return listed
    .filter(
      (deployment) =>
        deployment.payload.branch === branch &&
        Date.parse(deployment.created_at) < before,
    )
    .map((deployment) => deployment.id);
};

/** Whether a deployment's statuses (newest first, as GitHub lists them) leave it active. */
export const isStillActive = (statuses: DeploymentStatuses): boolean =>
  statuses[0]?.state !== 'inactive';

/** The status that retires a superseded deployment; GitHub shows a transient one as destroyed. */
export const INACTIVE_STATUS = {
  state: 'inactive',
  description: 'Superseded by a newer push to the branch',
} as const;
