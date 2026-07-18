// Pure shaping for the published-diff check runs: --json summaries in,
// Checks API payloads and gh argv out. The README badges read these runs by
// exact name via shields' check-runs endpoint, so `checkRunName` is the one
// place that composes it. action_required renders orange there — "a release
// is owed", never a CI failure; `failure` is deliberately unused. The IO
// (git rev-parse, gh api) lives in ./publish-check-runs.ts.

import type { PackageSummary } from './check-published-diff.core.ts';

export type CheckRunPayload = {
  name: string;
  conclusion: 'success' | 'action_required';
  title: string;
  summary: string;
  /** Only drifting runs set it; success keeps the default run link. */
  details_url?: string;
};

/** The exact run name the README badge nameFilter must match. */
export function checkRunName(packageName: string): string {
  return `published-diff (${packageName})`;
}

/** Where a drifting run's Resolve button lands: the release workflow's page. */
export function releaseWorkflowUrl(repo: string): string {
  return `https://github.com/${repo}/actions/workflows/bump-version.yml`;
}

/** Collapsed ship-inert listing appended to either verdict's summary. */
function inertDetails({ shipInert, shipInertFiles }: PackageSummary): string[] {
  if (shipInert === 0) return [];
  return [
    '',
    '<details>',
    `<summary>${shipInert} ship-inert file(s) — src/maps, never owe a release</summary>`,
    '',
    ...shipInertFiles.map((file) => `- \`${file}\``),
    '',
    '</details>',
  ];
}

/** One package's summary → its Checks API payload. */
export function toCheckRun(
  summary: PackageSummary,
  repo: string,
): CheckRunPayload {
  const name = checkRunName(summary.name);
  if (summary.version === null) {
    return {
      name,
      conclusion: 'success',
      title: 'never published — nothing to diff',
      summary: `${summary.name} has no published \`latest\` to compare against.`,
    };
  }
  const spec = `${summary.name}@${summary.version}`;
  if (summary.shipAffecting > 0) {
    const releaseUrl = releaseWorkflowUrl(repo);
    return {
      name,
      conclusion: 'action_required',
      title: `unreleased changes vs ${summary.version} (${summary.shipAffecting} shipped files differ)`,
      summary: [
        // workflow_dispatch inputs can't be URL-prefilled; the user picks the package there.
        `To resolve: [release ${summary.name} via the bump-version workflow](${releaseUrl}) — select the package in its Run workflow menu.`,
        '',
        `A publish from main would ship ${summary.shipAffecting} file(s) that differ from ${spec}:`,
        '',
        ...summary.shipAffectingFiles.map((file) => `- \`${file}\``),
        ...inertDetails(summary),
      ].join('\n'),
      details_url: releaseUrl,
    };
  }
  return {
    name,
    conclusion: 'success',
    title: `up to date with ${summary.version}`,
    summary: [
      `Packed bytes match ${spec} — no ship-affecting drift.`,
      ...inertDetails(summary),
    ].join('\n'),
  };
}

/** argv for `gh api` creating one check run on `headSha`. */
export function checkRunApiArgs(
  repo: string,
  headSha: string,
  payload: CheckRunPayload,
): string[] {
  return [
    'api',
    `repos/${repo}/check-runs`,
    '-f',
    `name=${payload.name}`,
    '-f',
    `head_sha=${headSha}`,
    '-f',
    'status=completed',
    '-f',
    `conclusion=${payload.conclusion}`,
    ...(payload.details_url === undefined
      ? []
      : ['-f', `details_url=${payload.details_url}`]),
    '-f',
    `output[title]=${payload.title}`,
    '-f',
    `output[summary]=${payload.summary}`,
  ];
}
