// Pure logic for the catalog-duplication check — no filesystem or pnpm SDK here,
// so every unit is directly testable with plain fixtures (see check-catalog.test.mjs).
// The IO (enumerating workspace members, reading the workspace manifest) lives in
// check-catalog.mjs and feeds plain objects into these functions.

export const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

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
export function isInlineRegistryRange(spec) {
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
 * @param {Array<{ name: string, dir: string, manifest: object }>} members
 * @returns {Map<string, Map<string, Array<{ dir: string, field: string, spec: string }>>>}
 *          dep name -> consumer package name -> declaration sites
 */
export function collectInlineUsage(members) {
  const usage = new Map();
  for (const { name, dir, manifest } of members) {
    for (const field of DEP_FIELDS) {
      for (const [dep, spec] of Object.entries(manifest?.[field] ?? {})) {
        if (!isInlineRegistryRange(spec)) continue;
        if (!usage.has(dep)) usage.set(dep, new Map());
        const byConsumer = usage.get(dep);
        if (!byConsumer.has(name)) byConsumer.set(name, []);
        byConsumer.get(name).push({ dir, field, spec });
      }
    }
  }
  return usage;
}

/**
 * Reduce usage to violations: deps declared inline by 2+ distinct packages.
 * @returns {Array<{ dep: string, consumers: Map, specs: string[] }>} sorted by dep
 */
export function findViolations(usage) {
  const violations = [];
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
export function catalogDepNames(workspaceManifest) {
  const names = new Set(Object.keys(workspaceManifest?.catalog ?? {}));
  for (const catalog of Object.values(workspaceManifest?.catalogs ?? {})) {
    for (const name of Object.keys(catalog ?? {})) names.add(name);
  }
  return names;
}

/**
 * Render the human-readable report.
 * @returns {{ ok: boolean, text: string }}
 */
export function formatReport(
  violations,
  { memberCount, catalogNames = new Set() } = {},
) {
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
