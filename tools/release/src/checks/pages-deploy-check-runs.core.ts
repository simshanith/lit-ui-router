// Pure shaping for the Altitude Atlas deploy signal: the pages-deploy CLI's
// exit code and output in, one Checks API payload out, posted on the
// www/atlas head rather than main's. Same vocabulary as the workers-builds
// signal: action_required = a deploy is owed, neutral = the observer failed
// (a token without Pages read scope, an API outage). The IO lives in
// ./pages-deploy-check-runs.ts.

import {
  PAGES_PROJECT,
  PRODUCTION_BRANCH,
  isCommitSha,
} from '@tools/workers-builds/pages-deploy.core.ts';

import type { CliResult } from '../lib/run-cli.ts';
import type { CheckRunPayload } from './publish-check-runs.core.ts';
import { reportBlock } from './workers-builds-check-runs.core.ts';

/** The exact run name the www/DEPLOY.md badge nameFilter must match. */
export const PAGES_DEPLOY_CHECK_RUN_NAME = `pages-deploy (${PAGES_PROJECT})`;

/** argv for `gh api` printing the production branch's head sha. */
export function branchHeadApiArgs(repo: string): string[] {
  return [
    'api',
    `repos/${repo}/git/ref/heads/${PRODUCTION_BRANCH}`,
    '--jq',
    '.object.sha',
  ];
}

/** The sha `branchHeadApiArgs` printed, or throw. */
export function parseBranchHead(stdout: string): string {
  const sha = stdout.trim();
  if (!isCommitSha(sha)) {
    throw new Error(
      `${PRODUCTION_BRANCH} head did not resolve to a commit sha: ${JSON.stringify(sha)}`,
    );
  }
  return sha;
}

/** The CLI's verdict → its Checks API payload. */
export function toPagesDeployCheckRun(result: CliResult): CheckRunPayload {
  const name = PAGES_DEPLOY_CHECK_RUN_NAME;
  if (result.exitCode === 0) {
    return {
      name,
      conclusion: 'success',
      title: `production serves the ${PRODUCTION_BRANCH} head`,
      summary: [
        `The latest production deployment of the \`${PAGES_PROJECT}\` Pages`,
        `project records this commit, the head of \`${PRODUCTION_BRANCH}\`.`,
        ...reportBlock(result.output),
      ].join('\n'),
    };
  }
  if (result.exitCode === 1) {
    return {
      name,
      conclusion: 'action_required',
      title: `a deploy is owed: production does not serve the ${PRODUCTION_BRANCH} head`,
      summary: [
        `The latest production deployment of the \`${PAGES_PROJECT}\` Pages`,
        `project records a different commit than the head of \`${PRODUCTION_BRANCH}\`.`,
        '',
        `To resolve: deploy from a checkout of \`${PRODUCTION_BRANCH}\` with the`,
        "recipe in the atlas tree's README, then run the release-signals",
        'workflow to re-check.',
        ...reportBlock(result.output),
      ].join('\n'),
    };
  }
  return {
    name,
    conclusion: 'neutral',
    title: 'could not verify — observer error, not a verdict on the deploy',
    summary: [
      `The deploy check could not reach a verdict (exit ${result.exitCode}).`,
      'A missing `CLOUDFLARE_API_TOKEN` secret, a token without Pages read',
      'scope, or a Cloudflare API outage says nothing about whether a deploy',
      'is owed, so this renders grey rather than sharing a colour with one.',
      ...reportBlock(result.output),
    ].join('\n'),
  };
}
