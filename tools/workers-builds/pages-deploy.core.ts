// Pure logic for the Pages deploy check — no network here, so the verdict is
// directly testable with plain fixtures (see pages-deploy.test.ts). The IO
// (env, the Cloudflare API) lives in pages-deploy.ts.

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
// https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/list/
const DeploymentSchema = v.looseObject({
  id: v.pipe(v.string(), v.nonEmpty()),
  created_on: timestamp,
  environment: v.string(),
  url: v.nullish(v.string()),
  latest_stage: v.looseObject({ name: v.string(), status: v.string() }),
  deployment_trigger: v.looseObject({
    type: v.string(),
    metadata: v.nullish(
      v.looseObject({
        branch: v.nullish(v.string()),
        commit_hash: v.nullish(v.string()),
        commit_dirty: v.nullish(v.boolean()),
      }),
    ),
  }),
});

const DeploymentsSchema = v.array(DeploymentSchema);

export type Deployment = v.InferOutput<typeof DeploymentSchema>;

/** The deployments list `result`, validated; throws with every issue's path. */
export function deploymentsFromApi(result: unknown): Deployment[] {
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
        deployment.latest_stage.status === 'success',
    )
    .sort((a, b) => Date.parse(b.created_on) - Date.parse(a.created_on))[0];
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
  const metadata = live.deployment_trigger.metadata;
  const deployed = metadata?.commit_hash ?? '';
  const lines = [
    ...header,
    `deployed commit: ${deployed || '(none recorded)'}${metadata?.commit_dirty ? ' (dirty tree)' : ''}`,
    `deployed branch: ${metadata?.branch || '(none recorded)'}`,
    `deployment: ${live.id} (${live.created_on})${live.url ? ` ${live.url}` : ''}`,
    '',
  ];
  const ok = deployed.toLowerCase() === branchHead.toLowerCase();
  lines.push(
    ok
      ? `✓ production serves the ${PRODUCTION_BRANCH} head.`
      : `✗ production does not serve the ${PRODUCTION_BRANCH} head; a deploy is owed.`,
  );
  return { ok, text: lines.join('\n') };
}
