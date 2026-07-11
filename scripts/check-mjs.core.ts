// Pure logic for the .mjs/.cjs guard — no git or filesystem here, so every
// unit is directly testable with plain fixtures (see check-mjs.test.ts).
// The IO (enumerating tracked files via git ls-files) lives in check-mjs.ts
// and feeds plain arrays into these functions.
//
// Policy: prefer .ts. Tracked .mjs/.cjs files sit outside every tsconfig, so
// oxlint's type-aware rules never see them — each survivor is a documented
// static-analysis hole and needs an explicit, reasoned allowlist entry.

import type { Report } from './types.ts';

// path -> one-line reason. The escape hatch: add an entry when a file truly
// cannot be .ts, delete it when the file goes. Keep this list short.
export const MJS_ALLOWLIST: ReadonlyMap<string, string> = new Map();

export type MjsFindings = {
  // Tracked .mjs/.cjs files with no allowlist entry.
  unlisted: string[];
  // Allowlist entries whose file is no longer tracked.
  stale: string[];
};

/** Diff the tracked .mjs/.cjs files against the allowlist. */
export function findMjsFindings(
  trackedFiles: string[],
  allowlist: ReadonlyMap<string, string> = MJS_ALLOWLIST,
): MjsFindings {
  const tracked = new Set(trackedFiles);
  return {
    unlisted: trackedFiles.filter((file) => !allowlist.has(file)).sort(),
    stale: [...allowlist.keys()].filter((file) => !tracked.has(file)).sort(),
  };
}

/** Render the findings; ok is false when anything needs fixing. */
export function formatReport(
  findings: MjsFindings,
  allowlist: ReadonlyMap<string, string> = MJS_ALLOWLIST,
): Report {
  const lines: string[] = [];
  for (const file of findings.unlisted) {
    lines.push(
      `✖ ${file} is a tracked .mjs/.cjs file. Convert it to .ts, or add it to`,
      `  MJS_ALLOWLIST in scripts/check-mjs.core.ts with a one-line reason.`,
    );
  }
  for (const file of findings.stale) {
    lines.push(
      `✖ ${file} is allowlisted but no longer tracked. Delete its MJS_ALLOWLIST entry.`,
    );
  }
  if (lines.length > 0) {
    return { ok: false, text: lines.join('\n') };
  }
  const allowed = allowlist.size;
  return {
    ok: true,
    text: `✓ mjs check passed — no unlisted .mjs/.cjs files, ${allowed} allowlisted.`,
  };
}
