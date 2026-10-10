// Pure logic for check-single-version.ts, which owns the IO.

import { parse } from 'yaml';

/** The slices of pnpm-lock.yaml the check reads. */
export type Lock = {
  catalogs?: Record<string, Record<string, { specifier: string }>>;
  overrides?: Record<string, string>;
  importers?: Record<
    string,
    Partial<
      Record<
        'dependencies' | 'devDependencies' | 'optionalDependencies',
        Record<string, { version: string }>
      >
    >
  >;
  packages?: Record<string, { resolution?: { integrity?: string } }>;
};

/** A package name the lock may resolve to more than one version. */
export type SplitAllowance = {
  name: string;
  /** Why the split is accepted rather than overridden. */
  why: string;
};

/** A package resolved to more than one version. */
export type Split = { name: string; versions: string[] };

export type SplitAudit = {
  failures: Split[];
  allowed: Split[];
  /** Allowed names that no longer split — the row outlived its reason. */
  stale: string[];
};

const LOCAL = /^(link|workspace|file):/;

export function parseLock(text: string): Lock {
  return (parse(text) as Lock | null) ?? {};
}

/** Splits `name@rest` at the `@` that ends the name, scoped or not. */
function splitAt(spec: string): [string, string] | undefined {
  const at = spec.indexOf('@', 1);

  return at === -1 ? undefined : [spec.slice(0, at), spec.slice(at + 1)];
}

/**
 * Name and version of one `packages:` key. Peer suffixes are dropped, an
 * `npm:` alias resolves to its target, and local protocols have no version.
 */
export function parsePackageKey(
  key: string,
): { name: string; version: string } | undefined {
  const parts = splitAt(key.replace(/\(.*$/, ''));

  if (!parts) return undefined;
  const [name, version] = parts;

  if (version.startsWith('npm:')) return parsePackageKey(version.slice(4));

  if (version === '' || LOCAL.test(version)) return undefined;

  return { name, version };
}

/** Every version the lock's `packages:` map resolves, per package name. */
export function lockVersions(lock: Lock): Map<string, string[]> {
  const versions = new Map<string, string[]>();

  for (const key of Object.keys(lock.packages ?? {})) {
    const parsed = parsePackageKey(key);

    if (!parsed) continue;
    const seen = versions.get(parsed.name) ?? [];

    if (!seen.includes(parsed.version)) seen.push(parsed.version);
    versions.set(parsed.name, seen);
  }

  return versions;
}

/**
 * Names the workspace chooses a version of: catalog entries, unranged
 * override targets and importers' direct dependencies, each alias resolved to
 * the package it installs.
 */
export function controlledNames(lock: Lock): Set<string> {
  return new Set([
    ...catalogNames(lock),
    ...overrideTargets(lock),
    ...importerNames(lock),
  ]);
}

function* catalogNames(lock: Lock): Generator<string> {
  for (const catalog of Object.values(lock.catalogs ?? {})) {
    for (const [name, { specifier }] of Object.entries(catalog)) {
      yield specifier.startsWith('npm:')
        ? (splitAt(specifier.slice(4))?.[0] ?? name)
        : name;
    }
  }
}

function* overrideTargets(lock: Lock): Generator<string> {
  for (const selector of Object.keys(lock.overrides ?? {})) {
    // a `>` inside a range follows `@`, a space or `<`; the parent separator does not
    const target = selector.split(/(?<![@\s<])>(?!=)/).at(-1) ?? selector;

    // a ranged target only lifts a floor within that range
    if (!splitAt(target)) yield target;
  }
}

function* importerNames(lock: Lock): Generator<string> {
  for (const importer of Object.values(lock.importers ?? {})) {
    for (const deps of [
      importer.dependencies,
      importer.devDependencies,
      importer.optionalDependencies,
    ]) {
      for (const [name, { version }] of Object.entries(deps ?? {})) {
        if (LOCAL.test(version)) continue;
        yield parsePackageKey(version)?.name ?? name;
      }
    }
  }
}

const byVersion = (a: string, b: string) =>
  a.localeCompare(b, 'en', { numeric: true });

/**
 * Controlled names resolved to more than one version. An exact pin beside a
 * newer caret has no common version, so `pnpm dedupe --check` passes it.
 */
export function auditSplits(
  versions: ReadonlyMap<string, readonly string[]>,
  controlled: ReadonlySet<string>,
  allowances: readonly SplitAllowance[],
): SplitAudit {
  const allowedNames = new Set(allowances.map(({ name }) => name));
  const failures: Split[] = [];
  const allowed: Split[] = [];

  for (const name of [...controlled].sort()) {
    const resolved = versions.get(name) ?? [];

    if (resolved.length < 2) continue;
    (allowedNames.has(name) ? allowed : failures).push({
      name,
      versions: [...resolved].sort(byVersion),
    });
  }

  const splitNames = new Set(allowed.map(({ name }) => name));
  const stale = [...allowedNames].filter((name) => !splitNames.has(name));

  return { failures, allowed, stale };
}

export function formatSplit({ name, versions }: Split): string {
  return `${name}: ${versions.join(', ')} (not allowlisted)`;
}
