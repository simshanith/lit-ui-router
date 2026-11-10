// Pure verdict logic for pages-deploy.ts; no network here.

import type { ListProjectDeploymentsResponse } from '@distilled.cloud/cloudflare/pages';
import * as v from 'valibot';

import type { Report } from './workers-builds-triggers.core.ts';

/** The direct-upload Pages project that serves atlas.lit-ui-router.dev. */
export const PAGES_PROJECT = 'altitude-atlas';

/** The branch `wrangler pages deploy --branch` publishes to production from. */
export const PRODUCTION_BRANCH = 'www/atlas';

const COMMIT_SHA = /^[0-9a-f]{40}$/;

/** A full lowercase commit sha, the form both GitHub and wrangler record. */
export function isCommitSha(value: string): boolean {
  return COMMIT_SHA.test(value);
}

const timestamp = v.pipe(
  v.string(),
  v.check((value) => !Number.isNaN(Date.parse(value)), 'not a timestamp'),
);

// looseObject throughout: a deployment carries far more than this check reads.
// The SDK camelCases wire names but, lenient by default, validates none of them.
// https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/
const DeploymentSchema = v.looseObject({
  id: v.pipe(v.string(), v.nonEmpty()),
  createdOn: timestamp,
  environment: v.string(),
  url: v.nullish(v.string()),
  latestStage: v.looseObject({ name: v.string(), status: v.string() }),
  deploymentTrigger: v.looseObject({
    type: v.string(),
    metadata: v.nullish(
      v.looseObject({
        branch: v.nullish(v.string()),
        commitHash: v.nullish(v.string()),
      }),
    ),
  }),
});

const DeploymentsSchema = v.array(DeploymentSchema);

export type Deployment = v.InferOutput<typeof DeploymentSchema>;

/** The deployments list `result`, validated; throws with every issue's path. */
export function deploymentsFromApi(
  result: ListProjectDeploymentsResponse['result'],
): Deployment[] {
  const parsed = v.safeParse(DeploymentsSchema, result);

  if (!parsed.success) {
    const details = parsed.issues.map((issue) => {
      const path = v.getDotPath(issue);

      return path ? `  ${path}: ${issue.message}` : `  ${issue.message}`;
    });

    throw new Error(
      ['unexpected Pages deployments response:', ...details].join('\n'),
    );
  }

  return parsed.output;
}

/**
 * The deployment serving production: the newest successful one. The API does
 * not document its ordering, so this sorts rather than trusting the first.
 */
export function liveProductionDeployment(
  deployments: readonly Deployment[],
): Deployment | undefined {
  return deployments
    .filter(
      (deployment) =>
        deployment.environment === 'production' &&
        deployment.latestStage.status === 'success',
    )
    .sort((a, b) => Date.parse(b.createdOn) - Date.parse(a.createdOn))[0];
}

/** Compare the live production deployment's commit with the branch head. */
export function deployVerdict(
  deployments: readonly Deployment[],
  branchHead: string,
): Report {
  const header = [
    `project: ${PAGES_PROJECT}`,
    `${PRODUCTION_BRANCH} head: ${branchHead}`,
  ];

  const live = liveProductionDeployment(deployments);

  if (!live) {
    return {
      ok: false,
      text: [
        ...header,
        '',
        '✗ no successful production deployment found; a deploy is owed.',
      ].join('\n'),
    };
  }

  const metadata = live.deploymentTrigger.metadata;
  const deployed = metadata?.commitHash ?? '';

  const lines = [
    ...header,
    `deployed commit: ${deployed || '(none recorded)'}`,
    `deployed branch: ${metadata?.branch || '(none recorded)'}`,
    `deployment: ${live.id} (${live.createdOn})${live.url ? ` ${live.url}` : ''}`,
    '',
  ];

  const ok = deployed === branchHead;
  lines.push(
    ok
      ? `✓ production serves the ${PRODUCTION_BRANCH} head.`
      : `✗ production does not serve the ${PRODUCTION_BRANCH} head; a deploy is owed.`,
  );

  return { ok, text: lines.join('\n') };
}
