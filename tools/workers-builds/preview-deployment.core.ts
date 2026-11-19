// Pure logic for preview-deployment.ts: a Workers Builds build in, the GitHub
// Deployment that names its preview URL out. No network here.

import type { ListBetaWorkerVersionsResponse } from '@distilled.cloud/cloudflare/workers';
import type {
  GetBuildResponse,
  GetBuildsByVersionResponse,
} from '@distilled.cloud/cloudflare/workers_builds';
import * as v from 'valibot';

import { isCommitSha } from './pages-deploy.core.ts';

/** GitHub environment prefix; the worker name follows it. */
export const ENVIRONMENT_PREFIX = 'preview/';

/** The branch every Worker's production trigger builds; its builds are not previews. */
export const PRODUCTION_BRANCH = 'main';

/** `getBuildsByVersion` takes at most this many version ids. */
export const MAX_VERSION_IDS = 20;

/** The worker and build a Cloudflare check run's details_url names. */
export type BuildRef = {
  readonly worker: string;
  readonly buildUuid: string;
  /** The Workers Previews slug, present for a Worker switched to Previews. */
  readonly previewSlug?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// .../workers/services/view/<worker>/production[/previews/<slug>]/builds/<uuid>
const BUILD_PATH =
  /^\/(?:[0-9a-f]{32})\/workers\/services\/view\/([a-z0-9-]+)\/production(?:\/previews\/([a-z0-9-]+))?\/builds\/([0-9a-f-]+)$/;

/** Whether `value` is a lowercase UUID, the form Workers Builds prints. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** The worker and build in a Cloudflare dashboard build URL, or undefined. */
export function parseDetailsUrl(detailsUrl: string): BuildRef | undefined {
  let url: URL;

  try {
    url = new URL(detailsUrl);
  } catch {
    return undefined;
  }

  if (url.origin !== 'https://dash.cloudflare.com') return undefined;

  const match = BUILD_PATH.exec(url.pathname);
  const [, worker, previewSlug, buildUuid] = match ?? [];

  if (worker === undefined || buildUuid === undefined || !isUuid(buildUuid)) {
    return undefined;
  }

  return previewSlug === undefined
    ? { worker, buildUuid }
    : { worker, buildUuid, previewSlug };
}

const timestamp = v.pipe(
  v.string(),
  v.check((value) => !Number.isNaN(Date.parse(value)), 'not a timestamp'),
);

// looseObject throughout: the SDK camelCases wire names but validates none of them.
const BuildSchema = v.looseObject({
  buildUuid: v.pipe(v.string(), v.check(isUuid, 'not a UUID')),
  buildOutcome: v.nullish(v.string()),
  createdOn: timestamp,
  stoppedOn: v.nullish(timestamp),
  // Despite its docs, the branch alias, not the commit's version URL.
  previewUrl: v.nullish(v.string()),
  buildTriggerMetadata: v.looseObject({
    branch: v.nullish(v.string()),
    commitHash: v.pipe(v.string(), v.check(isCommitSha, 'not a commit sha')),
  }),
});

const VersionSchema = v.looseObject({
  id: v.pipe(v.string(), v.check(isUuid, 'not a UUID')),
  createdOn: timestamp,
  urls: v.array(v.string()),
});

const BuildsByVersionSchema = v.looseObject({
  builds: v.nullish(
    v.record(v.string(), v.looseObject({ buildUuid: v.nullish(v.string()) })),
  ),
});

export type Build = v.InferOutput<typeof BuildSchema>;

export type Version = v.InferOutput<typeof VersionSchema>;

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

/** A `getBuild` result, validated. */
export function buildFromApi(result: GetBuildResponse): Build {
  return parsed('Workers Builds build', v.safeParse(BuildSchema, result));
}

/** A `listBetaWorkerVersions` page, validated. */
export function versionsFromApi(
  result: ListBetaWorkerVersionsResponse['result'],
): Version[] {
  return parsed(
    'Worker versions page',
    v.safeParse(v.array(VersionSchema), result),
  );
}

/** A `getBuildsByVersion` result as version id → build UUID. */
export function buildsByVersionFromApi(
  result: GetBuildsByVersionResponse,
): Map<string, string> {
  const { builds } = parsed(
    'builds-by-version response',
    v.safeParse(BuildsByVersionSchema, result),
  );

  return new Map(
    Object.entries(builds ?? {}).flatMap(([versionId, build]) =>
      build.buildUuid ? [[versionId, build.buildUuid] as const] : [],
    ),
  );
}

/** Whether a newest-first versions page reaches back past the build's start. */
export function pageReachesBefore(
  versions: readonly Version[],
  build: Build,
): boolean {
  const start = Date.parse(build.createdOn);

  return versions.some((version) => Date.parse(version.createdOn) < start);
}

/**
 * Versions the build could have uploaded: created while it ran. The API
 * documents no ordering, so this filters and sorts rather than slicing.
 */
export function candidateVersions(
  versions: readonly Version[],
  build: Build,
): Version[] {
  const start = Date.parse(build.createdOn);

  const end =
    build.stoppedOn == null
      ? Number.POSITIVE_INFINITY
      : Date.parse(build.stoppedOn);

  return [...versions]
    .filter((version) => {
      const created = Date.parse(version.createdOn);

      return created >= start && created <= end;
    })
    .sort((a, b) => Date.parse(b.createdOn) - Date.parse(a.createdOn))
    .slice(0, MAX_VERSION_IDS);
}

/** A preview build's URLs, ready to post as a deployment. */
export type Preview = {
  readonly worker: string;
  readonly environment: string;
  readonly sha: string;
  readonly branch: string | null;
  readonly buildUuid: string;
  readonly versionId: string;
  readonly commitUrl: string;
  readonly branchUrl: string | null;
  readonly logUrl: string;
};

/** Why a build gets no deployment. */
export type Skip = { readonly skip: string };

export type PreviewInput = {
  readonly ref: BuildRef;
  readonly build: Build;
  readonly versions: readonly Version[];
  readonly buildsByVersion: ReadonlyMap<string, string>;
  readonly logUrl: string;
};

/** The build's preview, or why it has none to post. */
export function previewFor({
  ref,
  build,
  versions,
  buildsByVersion,
  logUrl,
}: PreviewInput): Preview | Skip {
  if (build.buildUuid !== ref.buildUuid) {
    throw new Error(
      `asked for build ${ref.buildUuid}, Cloudflare returned ${build.buildUuid}`,
    );
  }

  if (build.buildOutcome !== 'success') {
    return { skip: `build outcome is ${build.buildOutcome ?? 'unknown'}` };
  }

  const branch = build.buildTriggerMetadata.branch ?? null;

  if (branch === PRODUCTION_BRANCH) {
    return { skip: `a ${PRODUCTION_BRANCH} build is a production deploy` };
  }

  const version = versions.find(
    (candidate) => buildsByVersion.get(candidate.id) === build.buildUuid,
  );

  const commitUrl = version?.urls[0];

  if (version === undefined || commitUrl === undefined) {
    return {
      skip:
        ref.previewSlug === undefined
          ? 'no Worker version with a URL came from this build'
          : `Workers Previews build (${ref.previewSlug}) uploaded no Worker version with a URL`,
    };
  }

  return {
    worker: ref.worker,
    environment: `${ENVIRONMENT_PREFIX}${ref.worker}`,
    sha: build.buildTriggerMetadata.commitHash,
    branch,
    buildUuid: build.buildUuid,
    versionId: version.id,
    commitUrl,
    branchUrl: build.previewUrl ?? null,
    logUrl,
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

/** argv for `gh api` creating the preview's deployment. */
export function createDeploymentArgs(repo: string, preview: Preview): string[] {
  return [
    'api',
    '--method',
    'POST',
    `repos/${repo}/deployments`,
    '-f',
    `ref=${preview.sha}`,
    '-f',
    `environment=${preview.environment}`,
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
    ...(preview.branch === null
      ? []
      : ['-f', `payload[branch]=${preview.branch}`]),
    '-f',
    `payload[version_id]=${preview.versionId}`,
    ...(preview.branchUrl === null
      ? []
      : ['-f', `payload[branch_url]=${preview.branchUrl}`]),
  ];
}

/** argv for `gh api` marking deployment `id` live; a dry run passes the `{id}` placeholder. */
export function createStatusArgs(
  repo: string,
  id: number | '{id}',
  preview: Preview,
): string[] {
  return [
    'api',
    '--method',
    'POST',
    `repos/${repo}/deployments/${id}/statuses`,
    '-f',
    'state=success',
    '-f',
    `environment_url=${preview.commitUrl}`,
    '-f',
    `log_url=${preview.logUrl}`,
    '-f',
    `description=Commit preview ${preview.versionId.slice(0, 8)}`,
    '-F',
    'auto_inactive=true',
  ];
}

const DeploymentSchema = v.looseObject({
  id: v.number(),
  sha: v.string(),
  environment: v.string(),
  created_at: timestamp,
  // GitHub stores a payload posted as a string verbatim; none of ours is.
  payload: v.fallback(
    v.looseObject({
      build_uuid: v.optional(v.string()),
      branch: v.optional(v.string()),
      branch_url: v.optional(v.string()),
    }),
    {},
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

/** The deployment already posted for this build, if a rerun got here first. */
export function existingDeployment(
  deployments: readonly GitHubDeployment[],
  preview: Preview,
): GitHubDeployment | undefined {
  return deployments.find(
    (deployment) =>
      deployment.environment === preview.environment &&
      deployment.payload.build_uuid === preview.buildUuid,
  );
}

/**
 * The branch's other deployments in the preview's environment. The environment
 * is shared by every PR, so auto_inactive would retire other branches' URLs.
 */
export function supersededDeployments(
  deployments: readonly GitHubDeployment[],
  preview: Preview,
  currentId: number,
): GitHubDeployment[] {
  return deployments.filter((deployment) => {
    if (
      deployment.environment !== preview.environment ||
      deployment.id === currentId
    ) {
      return false;
    }

    const { branch, branch_url: branchUrl } = deployment.payload;

    // Deployments posted before the branch was recorded carry only its alias.
    if (branch === undefined) {
      return preview.branchUrl !== null && branchUrl === preview.branchUrl;
    }

    return branch === preview.branch;
  });
}

/** Whether a `latestStatusArgs` response leaves the deployment still active. */
export function needsInactive(statusesJson: string): boolean {
  const [status] = parsed(
    'GitHub deployment statuses',
    v.safeParse(v.array(StatusSchema), JSON.parse(statusesJson)),
  );

  return status?.state !== 'inactive';
}

/** argv for `gh api` marking deployment `id` inactive, superseded by `preview`. */
export function inactiveStatusArgs(
  repo: string,
  id: number,
  preview: Preview,
): string[] {
  return [
    'api',
    '--method',
    'POST',
    `repos/${repo}/deployments/${id}/statuses`,
    '-f',
    'state=inactive',
    '-f',
    `description=Superseded by ${preview.sha.slice(0, 8)}`,
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

    if (
      seen === undefined ||
      Date.parse(deployment.created_at) > Date.parse(seen.created_at)
    ) {
      newest.set(deployment.environment, deployment);
    }
  }

  return [...newest.values()].sort((a, b) =>
    a.environment.localeCompare(b.environment),
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

/** One worker's preview as the Deployments API records it. */
export type PreviewRecord = {
  readonly worker: string;
  readonly environment: string;
  readonly sha: string;
  readonly state: string | null;
  readonly url: string | null;
  readonly logUrl: string | null;
};

/** A deployment and its `latestStatusArgs` response, as one record. */
export function previewRecord(
  deployment: GitHubDeployment,
  statusesJson: string,
): PreviewRecord {
  const [status] = parsed(
    'GitHub deployment statuses',
    v.safeParse(v.array(StatusSchema), JSON.parse(statusesJson)),
  );

  return {
    worker: deployment.environment.slice(ENVIRONMENT_PREFIX.length),
    environment: deployment.environment,
    sha: deployment.sha,
    state: status?.state ?? null,
    url: status?.environment_url ?? null,
    logUrl: status?.log_url ?? null,
  };
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
    .map(
      (record) =>
        `${record.worker}: ${record.url ?? `(${record.state ?? 'no status'})`}`,
    )
    .join('\n');
}
