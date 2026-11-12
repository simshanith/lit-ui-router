import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { parse } from 'yaml';

export const WORKSPACE_FILE = 'pnpm-workspace.yaml';

// devDependencies never reach the packed manifest, so their catalogs can't change a release.
const SHIPPED_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

const CATALOG_PROTOCOL = 'catalog:';

/** The manifest fields whose `catalog:` specs reach the packed manifest. */
export type ShippedDependencies = Partial<
  Record<(typeof SHIPPED_FIELDS)[number], Record<string, string>>
>;

/** Catalogs keyed by name; the unnamed catalog is `default`. */
export interface Catalogs {
  [catalog: string]: Record<string, string>;
}

interface WorkspaceCatalogs {
  catalog?: Record<string, string>;
  catalogs?: Catalogs;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

/**
 * The `[catalog, dependency]` pairs a package's shipped fields resolve through
 * `catalog:`; the unnamed catalog is `default`, per pnpm.
 */
export function consumedCatalogEntries(
  manifest: ShippedDependencies,
): Array<[string, string]> {
  return SHIPPED_FIELDS.flatMap((field) =>
    Object.entries(manifest[field] ?? {}).flatMap(
      ([name, spec]): Array<[string, string]> =>
        spec.startsWith(CATALOG_PROTOCOL)
          ? [[spec.slice(CATALOG_PROTOCOL.length) || 'default', name]]
          : [],
    ),
  );
}

/** Catalogs keyed by name, matching `selectCatalogs` in @tools/shared. */
export function parseCatalogs(source: string | undefined): Catalogs {
  // SAFETY: pnpm-workspace.yaml is a mapping whose catalogs map names to specs
  const manifest = (source === undefined ? undefined : parse(source)) as
    | WorkspaceCatalogs
    | undefined;

  return { default: manifest?.catalog ?? {}, ...manifest?.catalogs };
}

export function workspaceFileAt(cwd: string, rev: string): string | undefined {
  try {
    return git(cwd, 'show', `${rev}:${WORKSPACE_FILE}`);
  } catch {
    // a root commit, or a parent that predates the file
    return undefined;
  }
}

type CommitSkip = (commit: { hash?: string | null }) => boolean;

/**
 * Builds the writer's `skip` predicate for the package at `cwd`: a commit the
 * path filter admitted only through the workspace file is skipped unless it
 * changed an entry the package's shipped fields consume.
 */
export function createCatalogCommitSkip(cwd: string): CommitSkip {
  const verdicts = new Map<string, boolean>();
  let consumed: Array<[string, string]> | undefined;

  function changesConsumedEntry(hash: string): boolean {
    consumed ??= consumedCatalogEntries(
      // SAFETY: a package.json is a JSON object and every declared field is optional
      JSON.parse(
        readFileSync(join(cwd, 'package.json'), 'utf8'),
      ) as ShippedDependencies,
    );

    const before = parseCatalogs(workspaceFileAt(cwd, `${hash}^`));
    const after = parseCatalogs(workspaceFileAt(cwd, hash));

    return consumed.some(
      ([catalog, name]) => before[catalog]?.[name] !== after[catalog]?.[name],
    );
  }

  function skip(hash: string): boolean {
    const touchesPackage =
      git(
        cwd,
        'diff-tree',
        '--no-commit-id',
        '--name-only',
        '-r',
        '--root',
        hash,
        '--',
        '.',
      ).trim() !== '';

    return !touchesPackage && !changesConsumedEntry(hash);
  }

  return (commit) => {
    const { hash } = commit;

    if (!hash) return false;

    let verdict = verdicts.get(hash);

    if (verdict === undefined) {
      verdict = skip(hash);
      verdicts.set(hash, verdict);
    }

    return verdict;
  };
}

const skips = new Map<string, CommitSkip>();

/** The writer's `skip` for the package release-it runs in (its cwd). */
export function skipUnconsumedCatalogCommit(commit: {
  hash?: string | null;
}): boolean {
  const cwd = process.cwd();
  let skip = skips.get(cwd);

  if (skip === undefined) {
    skip = createCatalogCommitSkip(cwd);
    skips.set(cwd, skip);
  }

  return skip(commit);
}
