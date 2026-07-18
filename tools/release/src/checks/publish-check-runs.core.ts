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
};

/** The exact run name the README badge nameFilter must match. */
export function checkRunName(packageName: string): string {
  return `published-diff (${packageName})`;
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
export function toCheckRun(summary: PackageSummary): CheckRunPayload {
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
    return {
      name,
      conclusion: 'action_required',
      title: `unreleased changes vs ${summary.version} (${summary.shipAffecting} shipped files differ)`,
      summary: [
        `A publish from main would ship ${summary.shipAffecting} file(s) that differ from ${spec}:`,
        '',
        ...summary.shipAffectingFiles.map((file) => `- \`${file}\``),
        ...inertDetails(summary),
      ].join('\n'),
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
    '-f',
    `output[title]=${payload.title}`,
    '-f',
    `output[summary]=${payload.summary}`,
  ];
}
