// Pure logic for the packed exports/types check — no filesystem, pnpm, attw, or
// publint here (structural inputs only), so every unit is directly testable with
// plain fixtures (see check-exports.test.ts). The IO (packing each publishable
// package and running attw + publint over the tarball) lives in check-exports.ts.

import type { Report } from './types.ts';

// The @arethetypeswrong/cli `esm-only` profile: these packages are ESM-only
// forever, so node10 (no exports-map support) and require-from-CJS resolutions
// never gate; a broken node16-esm/bundler resolution still does.
const IGNORED_RESOLUTIONS = new Set(['node10', 'node16-cjs']);

/** A gating attw problem, reduced to the fields the report renders. */
export type AttwProblem = {
  kind: string;
  entrypoint?: string;
  resolutionKind?: string;
};

// checkPackage returns `types: false` for a package shipping no declarations,
// which attw exits 0 on; every publishable package here is typed, so absent
// types is a gating failure instead.
const NO_TYPE_DECLARATIONS: AttwProblem = { kind: 'NoTypeDeclarations' };

// The subset of @arethetypeswrong/core's CheckResult this predicate reads; the
// real Analysis | UntypedResult is assignable to it.
type AttwAnalysis = {
  types: unknown;
  problems?: readonly AttwProblem[];
};

/**
 * attw problems that gate under the esm-only profile — the port of the CLI's
 * getExitCode: a problem gates unless it carries an ignored resolutionKind.
 */
export function attwGatingProblems(analysis: AttwAnalysis): AttwProblem[] {
  if (!analysis.types) return [NO_TYPE_DECLARATIONS];
  return (analysis.problems ?? []).filter(
    (problem) =>
      problem.resolutionKind === undefined ||
      !IGNORED_RESOLUTIONS.has(problem.resolutionKind),
  );
}

/** publint messages that gate: `error` and `warning`; `suggestion` is reported. */
export function publintGatingMessages<T extends { type: string }>(
  messages: readonly T[],
): T[] {
  return messages.filter((m) => m.type === 'error' || m.type === 'warning');
}

/** One package's verdict, ready to render. publint messages arrive formatted. */
export type PackageExportsCheck = {
  name: string;
  dir: string;
  attw: AttwProblem[];
  publint: string[];
  suggestions: string[];
};

function formatAttwProblem(problem: AttwProblem): string {
  const entrypoint = problem.entrypoint ? ` — ${problem.entrypoint}` : '';
  const resolution = problem.resolutionKind
    ? ` (${problem.resolutionKind})`
    : '';
  return `${problem.kind}${entrypoint}${resolution}`;
}

function suggestionLines(results: PackageExportsCheck[]): string[] {
  const withSuggestions = results.filter((r) => r.suggestions.length > 0);
  if (withSuggestions.length === 0) return [];
  const lines = ['', 'publint suggestions (not gating):'];
  for (const { name, suggestions } of withSuggestions) {
    lines.push(`  ${name}`);
    for (const message of suggestions) lines.push(`      • ${message}`);
  }
  return lines;
}

/** Render the human-readable report. */
export function formatExportsReport(results: PackageExportsCheck[]): Report {
  if (results.length === 0) {
    return {
      ok: false,
      text: '✗ exports check failed — no publishable workspace packages found (broken workspace globs?).',
    };
  }

  const suggestions = suggestionLines(results);
  const bad = results.filter((r) => r.attw.length > 0 || r.publint.length > 0);
  if (bad.length === 0) {
    return {
      ok: true,
      text: [
        `✓ exports check passed — ${results.length} publishable packages, ` +
          `publint + attw clean (esm-only profile).`,
        ...suggestions,
      ].join('\n'),
    };
  }

  const lines = [
    '✗ exports check failed — packed exports/types do not resolve ' +
      '(publishing would break consumers):',
    '',
  ];
  for (const { name, dir, attw, publint } of bad) {
    lines.push(`  ${name} (${dir})`);
    for (const problem of attw) {
      lines.push(`      • attw: ${formatAttwProblem(problem)}`);
    }
    for (const message of publint) lines.push(`      • publint: ${message}`);
    lines.push('');
  }
  lines.push(...suggestions);
  return { ok: false, text: lines.join('\n').trimEnd() };
}
