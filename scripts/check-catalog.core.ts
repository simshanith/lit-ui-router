// Pure logic for the catalog-duplication check — no filesystem or pnpm SDK here,
// so every unit is directly testable with plain fixtures (see check-catalog.test.ts).
// The IO (enumerating workspace members, reading the workspace manifest) lives in
// check-catalog.ts and feeds plain objects into these functions.

import {
  DEP_FIELDS,
  type DepField,
  type Member,
  type Report,
} from './types.ts';

export type DeclarationSite = { dir: string; field: DepField; spec: string };

// dep name -> consumer package name -> that consumer's declaration sites.
export type InlineUsage = Map<string, Map<string, DeclarationSite[]>>;

// A dependency declared inline by 2+ packages, with every specifier seen.
export type Violation = {
  dep: string;
  consumers: Map<string, DeclarationSite[]>;
  specs: string[];
};

// The catalog-bearing shape of pnpm-workspace.yaml that catalogDepNames reads.
export type WorkspaceCatalogs = {
  catalog?: Record<string, unknown>;
  catalogs?: Record<string, Record<string, unknown> | undefined>;
};

// Specifier prefixes that are already "managed" — i.e. not an inline registry
// range that could/should be hoisted into the catalog.
const MANAGED_PREFIXES = [
  'catalog:',
  'workspace:',
  'link:',
  'file:',
  'portal:',
  'npm:',
];

/** True when `spec` is a plain registry range/tag (the kind a catalog would hold). */
export function isInlineRegistryRange(spec: unknown): spec is string {
  if (typeof spec !== 'string') return false;
  const s = spec.trim();
  if (s.length === 0) return false;
  if (MANAGED_PREFIXES.some((p) => s.startsWith(p))) return false;
  if (s.includes('://')) return false; // http(s)/git url
  if (/^(git\+|git:|github:|gitlab:|bitbucket:)/.test(s)) return false;
  return true;
}

/**
 * Map each dependency to the workspace packages that declare it inline.
 * Returns: dep name -> consumer package name -> declaration sites.
 */
export function collectInlineUsage(members: Member[]): InlineUsage {
  const usage: InlineUsage = new Map();
  for (const { name, dir, manifest } of members) {
    for (const field of DEP_FIELDS) {
      for (const [dep, spec] of Object.entries(manifest?.[field] ?? {})) {
        if (!isInlineRegistryRange(spec)) continue;
        let byConsumer = usage.get(dep);
        if (!byConsumer) {
          byConsumer = new Map();
          usage.set(dep, byConsumer);
        }
        let sites = byConsumer.get(name);
        if (!sites) {
          sites = [];
          byConsumer.set(name, sites);
        }
        sites.push({ dir, field, spec });
      }
    }
  }
  return usage;
}

/**
 * Reduce usage to violations: deps declared inline by 2+ distinct packages.
 * The result is sorted by dependency name.
 */
export function findViolations(usage: InlineUsage): Violation[] {
  const violations: Violation[] = [];
  for (const [dep, consumers] of usage) {
    if (consumers.size < 2) continue;
    const specs = [
      ...new Set([...consumers.values()].flat().map((entry) => entry.spec)),
    ];
    violations.push({ dep, consumers, specs });
  }
  return violations.sort((a, b) => a.dep.localeCompare(b.dep));
}

/** Set of every dependency name defined in the default or any named catalog. */
export function catalogDepNames(
  workspaceManifest: WorkspaceCatalogs | undefined,
): Set<string> {
  const names = new Set(Object.keys(workspaceManifest?.catalog ?? {}));
  for (const catalog of Object.values(workspaceManifest?.catalogs ?? {})) {
    for (const name of Object.keys(catalog ?? {})) names.add(name);
  }
  return names;
}

// Options for formatReport: the count feeds the success line, and the set of
// already-catalogued dep names decides which fix hint each violation gets.
export type FormatReportOptions = {
  memberCount?: number;
  catalogNames?: Set<string>;
};

/** Render the human-readable report. */
export function formatReport(
  violations: Violation[],
  { memberCount, catalogNames = new Set<string>() }: FormatReportOptions = {},
): Report {
  if (violations.length === 0) {
    return {
      ok: true,
      text:
        `✓ catalog check passed — ${memberCount} workspace packages, ` +
        `no dependency declared inline by 2+ packages.`,
    };
  }

  const lines = [
    `✗ catalog check failed — dependencies declared inline by 2+ workspace ` +
      `packages must use \`catalog:\` (pnpm-workspace.yaml):`,
    '',
  ];
  for (const { dep, consumers, specs } of violations) {
    const drift =
      specs.length > 1
        ? ` (versions drift: ${specs.join(', ')})`
        : ` (${specs[0]})`;
    lines.push(
      `  ${dep} — declared inline by ${consumers.size} packages${drift}`,
    );
    for (const entries of consumers.values()) {
      for (const { dir, field, spec } of entries) {
        lines.push(`      • ${dir.padEnd(40)} ${field.padEnd(20)} ${spec}`);
      }
    }
    lines.push(
      catalogNames.has(dep)
        ? `      → catalog already defines "${dep}" — replace each inline range with "catalog:".`
        : `      → add "${dep}" to the \`catalog:\` in pnpm-workspace.yaml and replace each inline range with "catalog:".`,
    );
    lines.push('');
  }
  return { ok: false, text: lines.join('\n') };
}
