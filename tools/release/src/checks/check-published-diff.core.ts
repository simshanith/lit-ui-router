// Pure logic for the published-diff report — no filesystem, registry, or
// process spawning here, so every unit is directly testable with plain string
// fixtures (see check-published-diff.test.ts). The IO (building, packing with
// the publish workflow's manifest strip, running `npm diff`) lives in
// check-published-diff.ts.

import type { Report } from '../lib/types.ts';

// `npm diff` exits 0 whether or not the tarballs differ, so the verdict must
// come from its output: an empty diff is the only "nothing would ship" signal.
export function isCleanDiff(diffOutput: string): boolean {
  return diffOutput.trim().length === 0;
}

/**
 * Paths changed in a unified diff, taken from `+++` headers (additions and
 * modifications) plus `---` headers for deletions that have no `+++` side.
 * npm prefixes both sides with the package spec, e.g.
 * `+++ lit-ui-router@1.7.0/package/dist/index.js` — the leading spec and
 * `package/` segment are stripped so the report reads as tarball paths.
 */
export function changedFiles(diffOutput: string): string[] {
  const files = new Set<string>();
  for (const line of diffOutput.split('\n')) {
    const marker = line.startsWith('+++ ') || line.startsWith('--- ');
    if (!marker) continue;
    const rawPath = line.slice(4).trim();
    if (rawPath === '/dev/null') continue;
    files.add(rawPath.replace(/^[^/]*\//, '').replace(/^package\//, ''));
  }
  return [...files].sort();
}

// One package's comparison against its published `latest`.
export type DiffResult = {
  name: string;
  dir: string;
  /** Version currently on the `latest` dist-tag; absent when unpublished. */
  latest?: string;
  /** Version in the working tree's manifest. */
  localVersion?: string;
  status: 'clean' | 'drift' | 'unpublished';
  /** Tarball paths that differ; only meaningful for `drift`. */
  files?: string[];
};

export type ReportOptions = {
  /** When true, drift fails the report instead of merely being listed. */
  strict?: boolean;
};

/** Render the human-readable report. */
export function formatReport(
  results: DiffResult[],
  options: ReportOptions = {},
): Report {
  if (results.length === 0) {
    return {
      ok: false,
      text: '✗ published-diff check failed — no publishable workspace packages found (broken workspace globs?).',
    };
  }

  const drifted = results.filter((result) => result.status === 'drift');
  const lines: string[] = [];
  for (const result of results) {
    const { name, latest, localVersion, status, files } = result;
    if (status === 'unpublished') {
      lines.push(`  ${name}: never published — skipped`);
      continue;
    }
    const ahead =
      localVersion && latest && localVersion !== latest
        ? ` (local ${localVersion} ahead of published — release in flight?)`
        : '';
    if (status === 'clean') {
      lines.push(`  ${name}: clean vs ${latest}${ahead}`);
    } else {
      const count = files?.length ?? 0;
      lines.push(
        `  ${name}: SHIPS CHANGES vs ${latest}${ahead} — ${count} file(s):`,
      );
      for (const file of files ?? []) lines.push(`      • ${file}`);
    }
  }

  const ok = !options.strict || drifted.length === 0;
  const headline = ok
    ? drifted.length === 0
      ? `✓ published-diff check passed — ${results.length} packages match their published tarballs.`
      : `published-diff report — ${drifted.length} of ${results.length} packages would ship changes if released:`
    : `✗ published-diff check failed — ${drifted.length} of ${results.length} packages drift from their published tarballs:`;
  return { ok, text: [headline, ...lines].join('\n') };
}
