// The changelog drift findings as one Checks API payload; the IO lives in ./changelog-check-runs.ts.
import type { DriftFinding } from '@tools/changelog/drift.ts';

import type { CheckRunPayload } from './publish-check-runs.core.ts';

export const CHANGELOG_CHECK_RUN_NAME = 'changelog';

const RESYNC_WORKFLOW =
  'https://github.com/simshanith/lit-ui-router/actions/workflows/release-notes-resync.yml';

const lines = (findings: readonly DriftFinding[]): string[] =>
  findings.map(({ release, message }) => `- \`${release}\`: ${message}`);

const section = (
  heading: string,
  findings: readonly DriftFinding[],
): string[] =>
  findings.length === 0 ? [] : ['', `**${heading}**`, '', ...lines(findings)];

/** The findings, or the reason the ledger could not be read, as the check run. */
export function toChangelogCheckRun(
  findings: readonly DriftFinding[],
  unreachable: string | undefined,
): CheckRunPayload {
  const name = CHANGELOG_CHECK_RUN_NAME;
  const actions = findings.filter(({ level }) => level === 'action');

  const notes = section(
    'Notes',
    findings.filter(({ level }) => level === 'info'),
  );

  if (unreachable !== undefined) {
    return {
      name,
      conclusion: 'neutral',
      title: 'could not verify: the release ledger was unreachable',
      summary: [
        'The ledger could not be read, which says nothing about drift.',
        '',
        `- ${unreachable}`,
      ].join('\n'),
    };
  }

  if (actions.length > 0) {
    return {
      name,
      conclusion: 'action_required',
      title: `${actions.length} CHANGELOG.md section(s) disagree with the published notes`,
      summary: [
        "Each published package's CHANGELOG.md must hold every stable GitHub",
        'release body the release ledger stores. Correct a section by PR; once it',
        `merges, a maintainer runs [Release notes re-sync](${RESYNC_WORKFLOW})`,
        'to publish the file to GitHub. The ledger records the new bodies at its',
        'next tag sweep.',
        ...section('Disagreements', actions),
        ...notes,
      ].join('\n'),
    };
  }

  return {
    name,
    conclusion: 'success',
    title: 'every CHANGELOG.md matches the published notes',
    summary: [
      "Every stable release's section matches its GitHub release body.",
      ...notes,
    ].join('\n'),
  };
}
