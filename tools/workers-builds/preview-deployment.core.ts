// Pure logic for preview-deployment.ts: a Cloudflare Workers Builds check run
// in, the GitHub Deployment that names its preview URL out. No network here.

import * as v from 'valibot';

import { isCommitSha } from './pages-deploy.core.ts';

/** GitHub environment prefix; the worker name follows it. */
export const ENVIRONMENT_PREFIX = 'preview/';

/** The suffix of the environment that links each commit's own preview. */
export const COMMIT_SUFFIX = '/commit';

/** Which URL a deployment links: the branch alias, or the commit's own preview. */
export type Link = 'branch' | 'commit';

/** `preview/<worker>` links the branch alias; `preview/<worker>/commit` the commit preview. */
export function environmentOf(worker: string, link: Link): string {
  return `${ENVIRONMENT_PREFIX}${worker}${link === 'commit' ? COMMIT_SUFFIX : ''}`;
}

/** The worker a `preview/*` environment belongs to. */
export function workerOfEnvironment(environment: string): string {
  const name = environment.slice(ENVIRONMENT_PREFIX.length);

  return name.endsWith(COMMIT_SUFFIX)
    ? name.slice(0, -COMMIT_SUFFIX.length)
    : name;
}

/** The branch every Worker's production trigger builds; its builds are not previews. */
export const PRODUCTION_BRANCH = 'main';

/** The Cloudflare GitHub app that reports Workers Builds. */
export const CLOUDFLARE_APP = 'cloudflare-workers-and-pages';

/** Each Workers Builds check run is named this plus the worker. */
export const CHECK_RUN_PREFIX = 'Workers Builds: ';

/** The check run fields `post` reads, from the event payload or the REST API. */
export type CheckRun = {
  readonly name: string;
  readonly headSha: string;
  readonly headBranch: string;
  readonly detailsUrl: string;
  readonly summary: string;
};

/** The `Key: value` lines of a Workers Builds check run summary. */
export type Summary = {
  readonly buildUuid: string | null;
  /** The Build ID line's dashboard link, which names `/previews/<slug>/` for a Workers Previews build. */
  readonly buildUrl: string | null;
  readonly versionId: string | null;
  readonly previewUrl: string | null;
  readonly aliasUrl: string | null;
};

const LINE = /^(Build ID|Version ID|Preview URL|Preview Alias URL): (.+)$/;

// Build ID: [<uuid>](<dashboard url>)
const LINKED = /^\[([^\]]+)\]\(([^)]+)\)$/;

/** The summary's known lines; a line the format lacks reads as null. */
export function parseSummary(summary: string): Summary {
  const lines = new Map<string, string>();

  for (const line of summary.split('\n')) {
    const match = LINE.exec(line.trim());

    if (match?.[1] !== undefined && match[2] !== undefined) {
      lines.set(match[1], match[2].trim());
    }
  }

  const build = LINKED.exec(lines.get('Build ID') ?? '');

  return {
    buildUuid: build?.[1] ?? lines.get('Build ID') ?? null,
    buildUrl: build?.[2] ?? null,
    versionId: lines.get('Version ID') ?? null,
    previewUrl: lines.get('Preview URL') ?? null,
    aliasUrl: lines.get('Preview Alias URL') ?? null,
  };
}

/** A preview build's URLs, ready to post as deployments. */
export type Preview = {
  readonly worker: string;
  readonly sha: string;
  readonly branch: string;
  readonly buildUuid: string;
  readonly versionId: string;
  readonly commitUrl: string;
  readonly branchUrl: string | null;
  readonly logUrl: string;
};

/** Why a check run gets no deployment. */
export type Skip = { readonly worker: string; readonly skip: string };

/** The check run's worker, or throw for a run Workers Builds did not name. */
export function workerOf(name: string): string {
  const worker = name.startsWith(CHECK_RUN_PREFIX)
    ? name.slice(CHECK_RUN_PREFIX.length)
    : '';

  if (!/^[a-z0-9-]+$/.test(worker)) {
    throw new Error(`not a Workers Builds check run: ${JSON.stringify(name)}`);
  }

  return worker;
}

/**
 * The check run's preview, or why it has none. A successful branch build of a
 * versions-upload Worker without a `Preview URL:` line throws: the summary
 * format changed, and a silent skip would drop every preview.
 */
export function previewFromCheckRun(run: CheckRun): Preview | Skip {
  const worker = workerOf(run.name);

  if (!isCommitSha(run.headSha)) {
    throw new Error(`not a full commit sha: ${JSON.stringify(run.headSha)}`);
  }

  if (run.headBranch === PRODUCTION_BRANCH) {
    return {
      worker,
      skip: `a ${PRODUCTION_BRANCH} build is a production deploy`,
    };
  }

  const summary = parseSummary(run.summary);

  if (summary.previewUrl === null && summary.buildUrl?.includes('/previews/')) {
    return {
      worker,
      skip: 'Workers Previews build with preview URLs off: its summary names no URL',
    };
  }

  if (
    summary.previewUrl === null ||
    summary.versionId === null ||
    summary.buildUuid === null
  ) {
    throw new Error(
      `${run.name} on ${run.headBranch} has no Build ID, Version ID and Preview URL lines; the summary format may have changed:\n${run.summary}`,
    );
  }

  return {
    worker,
    sha: run.headSha,
    branch: run.headBranch,
    buildUuid: summary.buildUuid,
    versionId: summary.versionId,
    commitUrl: summary.previewUrl,
    branchUrl: summary.aliasUrl,
    logUrl: run.detailsUrl,
  };
}

/** One deployment `post` makes for a preview: its environment and the URL it links. */
export type Target = {
  readonly link: Link;
  readonly environment: string;
  readonly url: string;
};

/** The branch alias's deployment, when the summary names one, then the commit preview's. */
export function previewTargets(preview: Preview): Target[] {
  const commit: Target = {
    link: 'commit',
    environment: environmentOf(preview.worker, 'commit'),
    url: preview.commitUrl,
  };

  if (preview.branchUrl === null) return [commit];

  return [
    {
      link: 'branch',
      environment: environmentOf(preview.worker, 'branch'),
      url: preview.branchUrl,
    },
    commit,
  ];
}

/** A parse's output; throws naming every issue's path. */
function parsed<S extends v.GenericSchema>(
  what: string,
  result: v.SafeParseResult<S>,
): v.InferOutput<S> {
  if (result.success) return result.output;

  const details = result.issues.map((issue) => {
    const path = v.getDotPath(issue);

    return path ? `  ${path}: ${issue.message}` : `  ${issue.message}`;
  });

  throw new Error([`unexpected ${what}:`, ...details].join('\n'));
}

// looseObject throughout: GitHub's objects carry far more than these reads.
const CheckRunSchema = v.looseObject({
  name: v.string(),
  head_sha: v.string(),
  status: v.string(),
  conclusion: v.nullish(v.string()),
  details_url: v.string(),
  app: v.looseObject({ slug: v.string() }),
  check_suite: v.looseObject({ id: v.number() }),
  output: v.looseObject({ summary: v.nullish(v.string()) }),
});

export type RestCheckRun = v.InferOutput<typeof CheckRunSchema>;

/** argv for `gh api` reading one check run. */
export function checkRunArgs(repo: string, id: number): string[] {
  return ['api', `repos/${repo}/check-runs/${id}`];
}

/** argv for `gh api` printing a check suite's head branch. */
export function checkSuiteBranchArgs(repo: string, id: number): string[] {
  return ['api', `repos/${repo}/check-suites/${id}`, '--jq', '.head_branch'];
}

/** A `GET /check-runs/{id}` response, validated as a successful Workers Builds run. */
export function checkRunFromApi(json: string): RestCheckRun {
  const run = parsed(
    'GitHub check run',
    v.safeParse(CheckRunSchema, JSON.parse(json)),
  );

  if (run.app.slug !== CLOUDFLARE_APP || run.conclusion !== 'success') {
    throw new Error(
      `check run "${run.name}" is ${run.app.slug}'s, concluded ${run.conclusion ?? run.status}; post takes a successful ${CLOUDFLARE_APP} run`,
    );
  }

  return run;
}

/** A REST check run and its suite's branch, in the event payload's shape. */
export function checkRunOf(run: RestCheckRun, headBranch: string): CheckRun {
  return {
    name: run.name,
    headSha: run.head_sha,
    headBranch,
    detailsUrl: run.details_url,
    summary: run.output.summary ?? '',
  };
}

/** argv for `gh api` listing the newest deployments, narrowed by sha and environment. */
export function listDeploymentsArgs(
  repo: string,
  { sha, environment }: { sha?: string; environment?: string },
): string[] {
  const query = new URLSearchParams({ per_page: '100' });

  if (sha !== undefined) query.set('sha', sha);

  if (environment !== undefined) query.set('environment', environment);

  return ['api', `repos/${repo}/deployments?${query.toString()}`];
}

/** argv for `gh api` printing the repo's environment names, one per line. */
export function environmentsArgs(repo: string): string[] {
  return [
    'api',
    '--paginate',
    `repos/${repo}/environments?per_page=100`,
    '--jq',
    '.environments[].name',
  ];
}

/** The `preview/*` names among `environmentsArgs` output. */
export function previewEnvironments(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((name) => name.startsWith(ENVIRONMENT_PREFIX));
}

/** argv for `gh api` listing every deployment in `environment`, as one array per page. */
export function environmentDeploymentsArgs(
  repo: string,
  environment: string,
): string[] {
  const query = new URLSearchParams({ environment, per_page: '100' });

  return [
    'api',
    '--paginate',
    '--slurp',
    `repos/${repo}/deployments?${query.toString()}`,
  ];
}

/** argv for `gh api` creating the preview's deployment in `target`'s environment. */
export function createDeploymentArgs(
  repo: string,
  preview: Preview,
  target: Target,
): string[] {
  return [
    'api',
    '--method',
    'POST',
    `repos/${repo}/deployments`,
    '-f',
    `ref=${preview.sha}`,
    '-f',
    `environment=${target.environment}`,
    '-f',
    `description=Workers Builds ${preview.buildUuid}`,
    // A sha ref has nothing to merge, and the Cloudflare check run is the gate.
    '-F',
    'auto_merge=false',
    '-f',
    'required_contexts[]',
    '-F',
    'transient_environment=true',
    '-F',
    'production_environment=false',
    '-f',
    `payload[build_uuid]=${preview.buildUuid}`,
    '-f',
    `payload[branch]=${preview.branch}`,
    '-f',
    `payload[version_id]=${preview.versionId}`,
    '-f',
    `payload[link]=${target.link}`,
    ...(preview.branchUrl === null
      ? []
      : ['-f', `payload[branch_url]=${preview.branchUrl}`]),
  ];
}

/** argv for `gh api` marking deployment `id` live at `target`'s URL. */
export function createStatusArgs(
  repo: string,
  id: number,
  preview: Preview,
  target: Target,
): string[] {
  return [
    'api',
    '--method',
    'POST',
    `repos/${repo}/deployments/${id}/statuses`,
    '-f',
    'state=success',
    '-f',
    `environment_url=${target.url}`,
    '-f',
    `log_url=${preview.logUrl}`,
    '-f',
    `description=${target.link === 'branch' ? 'Branch preview' : 'Commit preview'} ${preview.versionId.slice(0, 8)}`,
  ];
}

const timestamp = v.pipe(
  v.string(),
  v.check((value) => !Number.isNaN(Date.parse(value)), 'not a timestamp'),
);

const DeploymentSchema = v.looseObject({
  id: v.number(),
  sha: v.string(),
  environment: v.string(),
  created_at: timestamp,
  // GitHub stores a payload posted as a string verbatim; none of ours is.
  payload: v.fallback(
    v.looseObject({
      build_uuid: v.nullish(v.string()),
      branch: v.nullish(v.string()),
      // Deployments posted before the branch alias had its own environment carry no link: commit.
      link: v.fallback(v.picklist(['branch', 'commit']), 'commit'),
    }),
    { link: 'commit' },
  ),
});

export type GitHubDeployment = v.InferOutput<typeof DeploymentSchema>;

/** A `POST /deployments` response, validated. */
export function deploymentFromApi(json: string): GitHubDeployment {
  return parsed(
    'GitHub deployment',
    v.safeParse(DeploymentSchema, JSON.parse(json)),
  );
}

/** A `GET /deployments` response, validated. */
export function deploymentsFromApi(json: string): GitHubDeployment[] {
  return parsed(
    'GitHub deployments list',
    v.safeParse(v.array(DeploymentSchema), JSON.parse(json)),
  );
}

/** An `environmentDeploymentsArgs` response, flattened and validated. */
export function deploymentPagesFromApi(json: string): GitHubDeployment[] {
  return parsed(
    'GitHub deployments pages',
    v.safeParse(v.array(v.array(DeploymentSchema)), JSON.parse(json)),
  ).flat();
}

/** The deployment already posted for this build and target, if a rerun got here first. */
export function existingDeployment(
  deployments: readonly GitHubDeployment[],
  preview: Preview,
  target: Target,
): GitHubDeployment | undefined {
  return deployments.find(
    (deployment) =>
      deployment.environment === target.environment &&
      deployment.payload.link === target.link &&
      deployment.payload.build_uuid === preview.buildUuid,
  );
}

/** Whether `a` was created before `b`; the id breaks a same-second tie. */
const createdBefore = (a: GitHubDeployment, b: GitHubDeployment): boolean => {
  const delta = Date.parse(a.created_at) - Date.parse(b.created_at);

  return delta < 0 || (delta === 0 && a.id < b.id);
};

/**
 * The branch's deployments in `current`'s environment created before it. The
 * environment is shared by every PR, so auto_inactive would retire other
 * branches' URLs; a late run must not retire a newer build's deployment.
 */
export function supersededDeployments(
  deployments: readonly GitHubDeployment[],
  current: GitHubDeployment,
  branch: string,
): GitHubDeployment[] {
  return deployments.filter(
    (deployment) =>
      deployment.environment === current.environment &&
      deployment.payload.branch === branch &&
      createdBefore(deployment, current),
  );
}

/** Every preview deployment `branch` posted, in any `preview/*` environment. */
export function branchDeployments(
  deployments: readonly GitHubDeployment[],
  branch: string,
): GitHubDeployment[] {
  return deployments.filter(
    (deployment) =>
      deployment.environment.startsWith(ENVIRONMENT_PREFIX) &&
      deployment.payload.branch === branch,
  );
}

/** argv for `gh api` reading a deployment's newest status. */
export function latestStatusArgs(repo: string, id: number): string[] {
  return ['api', `repos/${repo}/deployments/${id}/statuses?per_page=1`];
}

const StatusSchema = v.looseObject({
  state: v.string(),
  environment_url: v.nullish(v.string()),
  log_url: v.nullish(v.string()),
});

/** Whether a `latestStatusArgs` response leaves the deployment still active. */
export function needsInactive(statusesJson: string): boolean {
  const [status] = parsed(
    'GitHub deployment statuses',
    v.safeParse(v.array(StatusSchema), JSON.parse(statusesJson)),
  );

  return status?.state !== 'inactive';
}

/** argv for `gh api` marking deployment `id` inactive, with why. */
export function inactiveStatusArgs(
  repo: string,
  id: number,
  description: string,
): string[] {
  return [
    'api',
    '--method',
    'POST',
    `repos/${repo}/deployments/${id}/statuses`,
    '-f',
    'state=inactive',
    '-f',
    `description=${description}`,
  ];
}

/** The newest deployment per preview environment. */
export function latestPreviewDeployments(
  deployments: readonly GitHubDeployment[],
): GitHubDeployment[] {
  const newest = new Map<string, GitHubDeployment>();

  for (const deployment of deployments) {
    if (!deployment.environment.startsWith(ENVIRONMENT_PREFIX)) continue;

    const seen = newest.get(deployment.environment);

    if (seen === undefined || createdBefore(seen, deployment)) {
      newest.set(deployment.environment, deployment);
    }
  }

  return [...newest.values()].sort((a, b) =>
    a.environment.localeCompare(b.environment),
  );
}

/** One preview deployment and its newest status. */
export type PreviewLink = {
  readonly worker: string;
  readonly link: Link;
  readonly sha: string;
  readonly state: string | null;
  readonly url: string | null;
  readonly logUrl: string | null;
};

/** A deployment and its `latestStatusArgs` response, as one link. */
export function previewLink(
  deployment: GitHubDeployment,
  statusesJson: string,
): PreviewLink {
  const [status] = parsed(
    'GitHub deployment statuses',
    v.safeParse(v.array(StatusSchema), JSON.parse(statusesJson)),
  );

  return {
    worker: workerOfEnvironment(deployment.environment),
    link: deployment.payload.link,
    sha: deployment.sha,
    state: status?.state ?? null,
    url: status?.environment_url ?? null,
    logUrl: status?.log_url ?? null,
  };
}

/** One worker's preview as the Deployments API records it. */
export type PreviewRecord = {
  readonly worker: string;
  readonly state: string | null;
  readonly branchUrl: string | null;
  readonly commitUrl: string | null;
  readonly logUrl: string | null;
};

/** One record per worker; the commit link's state and log, else the branch link's. */
export function previewRecords(links: readonly PreviewLink[]): PreviewRecord[] {
  const workers = [...new Set(links.map(({ worker }) => worker))].sort();

  return workers.map((worker) => {
    const own = links.filter((link) => link.worker === worker);
    const branch = own.find(({ link }) => link === 'branch');
    const commit = own.find(({ link }) => link === 'commit');
    const primary = commit ?? branch;

    return {
      worker,
      state: primary?.state ?? null,
      branchUrl: branch?.url ?? null,
      commitUrl: commit?.url ?? null,
      logUrl: primary?.logUrl ?? null,
    };
  });
}

/** argv for `gh api` printing a PR's head sha. */
export function prHeadArgs(repo: string, pr: number): string[] {
  return ['api', `repos/${repo}/pulls/${pr}`, '--jq', '.head.sha'];
}

/** Human-readable lines for `read`. */
export function recordsText(
  sha: string,
  records: readonly PreviewRecord[],
): string {
  if (records.length === 0) return `no preview deployments on ${sha}`;

  return records
    .map((record) =>
      [
        `${record.worker}: ${record.state ?? 'no status'}`,
        `  branch: ${record.branchUrl ?? '(none)'}`,
        `  commit: ${record.commitUrl ?? '(none)'}`,
      ].join('\n'),
    )
    .join('\n');
}
