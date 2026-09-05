// Pure shaping for the workers-builds CD-pipeline signal: the
// workers-builds-triggers CLI's exit code and console output in, one Checks
// API payload out. Third member of the release-signals family (published-diff
// for the npm artifacts, peer-floor for peer ranges, this for the deploy
// pipeline that ships lit-ui-router.dev) — same vocabulary: action_required
// renders orange ("the dashboard owes an apply"), never a CI failure, and
// `failure` is deliberately unused.
//
// The exit-2 → `neutral` mapping is the load-bearing one: an expired token, a
// missing secret, or a Cloudflare outage is a failure of the OBSERVER, not
// evidence about the observed dashboard, so it must render grey rather than
// share a colour with real drift. The IO (running the CLI, gh) lives in
// ./workers-builds-check-runs.ts.

import type { CheckRunPayload } from './publish-check-runs.core.ts';

export type TriggerCheckResult = {
  /** The CLI's exit code: 0 in sync, 1 drifted, 2 usage/API error. */
  exitCode: number;
  /** Combined stdout+stderr — the CLI's own report text. */
  output: string;
};

/** The exact run name the README badge nameFilter must match. */
export const WORKERS_BUILDS_CHECK_RUN_NAME = 'workers-builds (triggers)';

/** Checks API output.summary caps at 65535 chars; leave room for the framing. */
const MAX_REPORT_CHARS = 60_000;

function reportBlock(output: string): string[] {
  const text = output.trim();
  if (text === '') return [];
  const clipped =
    text.length > MAX_REPORT_CHARS
      ? `${text.slice(0, MAX_REPORT_CHARS)}\n… report truncated`
      : text;
  return ['', '```', clipped, '```'];
}

/** The CLI's verdict → its Checks API payload. */
export function toWorkersBuildsCheckRun(
  result: TriggerCheckResult,
  repo: string,
): CheckRunPayload {
  const name = WORKERS_BUILDS_CHECK_RUN_NAME;
  const configUrl = `https://github.com/${repo}/blob/main/tools/workers-builds/workers-builds-triggers.config.jsonc`;
  if (result.exitCode === 0) {
    return {
      name,
      conclusion: 'success',
      title: 'dashboard triggers match the repo config',
      summary: [
        'The live Cloudflare Workers Builds triggers that deploy',
        `lit-ui-router.dev match [workers-builds-triggers.config.jsonc](${configUrl}).`,
        ...reportBlock(result.output),
      ].join('\n'),
    };
  }
  if (result.exitCode === 1) {
    return {
      name,
      conclusion: 'action_required',
      title: 'trigger drift: the dashboard no longer matches the repo config',
      summary: [
        'The live Workers Builds triggers drifted from',
        `[workers-builds-triggers.config.jsonc](${configUrl}) — the deploy`,
        'pipeline that ships lit-ui-router.dev is running configuration with',
        'no PR trail.',
        '',
        'To resolve: decide which side is right. If the config is, run',
        '`pnpm check:workers-builds -- --apply` from the owning checkout (it',
        'needs the Edit-scoped user token, which CI deliberately does not',
        'have). If the dashboard is, update the config in a PR. This run',
        're-checks on the next push to `main` and flips green.',
        ...reportBlock(result.output),
      ].join('\n'),
      // details_url: not settable — GitHub pins GITHUB_TOKEN-created check runs to their own page
    };
  }
  return {
    name,
    conclusion: 'neutral',
    title: 'could not verify — observer error, not a verdict on the dashboard',
    summary: [
      `The trigger check could not reach a verdict (exit ${result.exitCode}).`,
      'A missing/expired `CLOUDFLARE_API_TOKEN` secret or a Cloudflare API',
      'outage says nothing about whether the dashboard drifted, so this',
      'renders grey rather than sharing a colour with real drift.',
      '',
      'See docs/DEPLOY.md for the required secrets and the read-only token scope.',
      ...reportBlock(result.output),
    ].join('\n'),
  };
}
