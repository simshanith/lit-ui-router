// Pure logic for the published-diff report — no filesystem, registry, or
// process spawning here, so every unit is directly testable with plain string
// fixtures (see check-published-diff.test.ts). The IO (building, packing with
// the publish workflow's manifest strip, running `npm diff`) lives in
// check-published-diff.ts.

import {
  assertKnownChannel,
  prereleaseChannel,
} from '../steps/release-prev-tag.core.ts';
import type { Report } from './types.ts';

/**
 * The dist-tag a publish of `localVersion` would write, resolved against the
 * tags the registry carries: a prerelease answers to its channel, everything
 * else to `latest`; a channel the registry lacks falls back to `latest`. Null
 * when the package carries no dist-tags at all; throws on an unknown channel.
 */
export function selectTarget(
  packageName: string,
  localVersion: string | undefined,
  distTags: Record<string, string>,
): { tag: string; version: string } | null {
  const channel = assertKnownChannel(
    localVersion ?? '',
    `${packageName}@${localVersion}`,
  );
  const preferred = channel ?? 'latest';
  const version = distTags[preferred];
  if (version !== undefined) return { tag: preferred, version };
  const latest = distTags.latest;
  if (latest !== undefined) return { tag: 'latest', version: latest };
  return null;
}

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

/** Ship-affecting drift owes a release; src/map paths never do — atomic packs make a masking src-only diff impossible. */
export function isShipAffecting(file: string): boolean {
  return !(file.startsWith('src/') || /^dist\/.*\.map$/.test(file));
}

/** Manifest fields whose entire consumer effect is the packed file set. */
export const MANIFEST_INERT_FIELDS: readonly string[] = ['files'];

/** True when any diff header has a /dev/null side — a file added or removed. */
export function hasFileSetChange(diffOutput: string): boolean {
  return diffOutput
    .split('\n')
    .some(
      (line) =>
        (line.startsWith('+++ ') || line.startsWith('--- ')) &&
        line.slice(4).trim() === '/dev/null',
    );
}

/**
 * Top-level manifest fields whose values differ between the two sides.
 * Both arrive as parsed package.json objects read from the compared
 * tarballs (tarballManifest); read/parse failures never reach here — the
 * IO fails safe to ship-affecting.
 */
export function manifestDriftFields(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys]
    .filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    .sort();
}

/**
 * package.json drift is ship-inert iff the packed file sets are identical
 * AND every drifting field's consumer effect is captured by that file-set
 * comparison (MANIFEST_INERT_FIELDS). A formatting-only diff (no field
 * drift) is vacuously confined. Any other field, or any file-set change,
 * stays ship-affecting.
 */
export function isManifestDriftInert(options: {
  fileSetChanged: boolean;
  driftFields: string[];
}): boolean {
  const { fileSetChanged, driftFields } = options;
  return (
    !fileSetChanged &&
    driftFields.every((field) => MANIFEST_INERT_FIELDS.includes(field))
  );
}

/** Split a diff's file list into ship-affecting and ship-inert. */
export function classifyFiles(files: string[]): {
  shipAffecting: string[];
  shipInert: string[];
} {
  const shipAffecting: string[] = [];
  const shipInert: string[] = [];
  for (const file of files)
    (isShipAffecting(file) ? shipAffecting : shipInert).push(file);
  return { shipAffecting, shipInert };
}

// One package's comparison against the dist-tag its next publish would write.
export type DiffResult = {
  name: string;
  dir: string;
  /** The dist-tag compared against; absent when unpublished. */
  tag?: string;
  /** Version currently on that dist-tag; absent when unpublished. */
  version?: string;
  /** Version in the working tree's manifest. */
  localVersion?: string;
  /** `ship-inert` = only src/maps/inert-manifest drift; release not owed. */
  status: 'clean' | 'drift' | 'ship-inert' | 'unpublished';
  /** Ship-affecting tarball paths; only meaningful for `drift`. */
  files?: string[];
  /** Ship-inert paths (src/**, dist maps, inert package.json); never owing. */
  shipInertFiles?: string[];
};

/** Filter publishable names to a comma-separated scope; empty/unset = all, unknown names throw. */
export function scopePackages(
  publishable: string[],
  scope: string | undefined,
): string[] {
  const requested = (scope ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  if (requested.length === 0) return publishable;
  const unknown = requested.filter((name) => !publishable.includes(name));
  if (unknown.length > 0) {
    throw new Error(
      `PUBLISHED_DIFF_PACKAGES names no publishable member: ${unknown.join(', ')} — publishable: ${publishable.join(', ')}`,
    );
  }
  return publishable.filter((name) => requested.includes(name));
}

/** Per-package machine verdict; `tag`/`version` name the compared dist-tag (null when unpublished). */
export type PackageSummary = {
  name: string;
  dir: string;
  tag: string | null;
  version: string | null;
  shipAffecting: number;
  shipInert: number;
  clean: boolean;
  shipAffectingFiles: string[];
  shipInertFiles: string[];
};

/** Shape results for the --json output; `clean` = no ship-affecting drift. */
export function summarizeResults(results: DiffResult[]): PackageSummary[] {
  return results.map(
    ({ name, dir, tag, version, status, files, shipInertFiles }) => {
      const shipAffectingFiles = status === 'drift' ? (files ?? []) : [];
      const inert = shipInertFiles ?? [];
      return {
        name,
        dir,
        tag: tag ?? null,
        version: version ?? null,
        shipAffecting: shipAffectingFiles.length,
        shipInert: inert.length,
        clean: status !== 'drift',
        shipAffectingFiles,
        shipInertFiles: inert,
      };
    },
  );
}

/** Canonical --json bytes: 2-space indent, trailing newline. */
export function renderSummary(summaries: PackageSummary[]): string {
  return `${JSON.stringify(summaries, null, 2)}\n`;
}

/** The parenthetical when the local version is not the compared one. */
function aheadNote(
  localVersion: string | undefined,
  tag: string | undefined,
  version: string | undefined,
): string {
  if (!localVersion || !tag || !version || localVersion === version) return '';
  const channel = prereleaseChannel(localVersion);
  if (channel !== undefined && tag === 'latest') {
    return ` (local ${localVersion} has no ${channel} tag yet — compared against latest ${version})`;
  }
  return ` (local ${localVersion} ahead of published — release in flight?)`;
}

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
    const { name, tag, version, localVersion, status, files, shipInertFiles } =
      result;
    if (status === 'unpublished') {
      lines.push(`  ${name}: never published — skipped`);
      continue;
    }
    const target = `${tag} ${version}`;
    const ahead = aheadNote(localVersion, tag, version);
    if (status === 'clean') {
      lines.push(`  ${name}: clean vs ${target}${ahead}`);
    } else if (status === 'ship-inert') {
      const count = shipInertFiles?.length ?? 0;
      lines.push(
        `  ${name}: ship-inert drift vs ${target}${ahead} — ${count} ship-inert file(s):`,
      );
      for (const file of shipInertFiles ?? []) lines.push(`      ◦ ${file}`);
    } else {
      const count = files?.length ?? 0;
      lines.push(
        `  ${name}: SHIPS CHANGES vs ${target}${ahead} — ${count} ship-affecting file(s):`,
      );
      for (const file of files ?? []) lines.push(`      • ${file}`);
      for (const file of shipInertFiles ?? [])
        lines.push(`      ◦ ${file} (ship-inert)`);
    }
  }

  const shipInertOnly = results.filter(
    (result) => result.status === 'ship-inert',
  );
  const ok = !options.strict || drifted.length === 0;
  const shipInertNote =
    shipInertOnly.length > 0 ? ` (${shipInertOnly.length} ship-inert)` : '';
  const headline = ok
    ? drifted.length === 0
      ? `✓ published-diff check passed — ${results.length} packages, no ship-affecting drift${shipInertNote}.`
      : `published-diff report — ${drifted.length} of ${results.length} packages would ship changes if released${shipInertNote}:`
    : `✗ published-diff check failed — ${drifted.length} of ${results.length} packages drift from their published tarballs${shipInertNote}:`;
  return { ok, text: [headline, ...lines].join('\n') };
}
