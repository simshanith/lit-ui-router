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
];

const CATALOG_PROTOCOL = 'catalog:';

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/**
 * The `[catalog, dependency]` pairs a package's shipped fields resolve through
 * `catalog:`; the unnamed catalog is `default`, per pnpm.
 *
 * @param {Record<string, Record<string, string> | undefined>} manifest
 * @returns {Array<[string, string]>}
 */
export function consumedCatalogEntries(manifest) {
  return SHIPPED_FIELDS.flatMap((field) =>
    Object.entries(manifest[field] ?? {})
      .filter(([, spec]) => spec.startsWith(CATALOG_PROTOCOL))
      .map(([name, spec]) => [
        spec.slice(CATALOG_PROTOCOL.length) || 'default',
        name,
      ]),
  );
}

/**
 * Catalogs keyed by name, matching `selectCatalogs` in @tools/shared.
 *
 * @param {string | undefined} source
 * @returns {Record<string, Record<string, string>>}
 */
export function parseCatalogs(source) {
  const manifest = source === undefined ? undefined : parse(source);

  return { default: manifest?.catalog ?? {}, ...manifest?.catalogs };
}

function workspaceFileAt(cwd, rev) {
  try {
    return git(cwd, 'show', `${rev}:${WORKSPACE_FILE}`);
  } catch {
    // a root commit, or a parent that predates the file
    return undefined;
  }
}

/**
 * Builds the writer's `skip` predicate for the package at `cwd`: a commit the
 * path filter admitted only through the workspace file is skipped unless it
 * changed an entry the package's shipped fields consume.
 *
 * @param {string} cwd
 * @returns {(commit: { hash?: string | null }) => boolean}
 */
export function createCatalogCommitSkip(cwd) {
  const verdicts = new Map();
  let consumed;

  function changesConsumedEntry(hash) {
    consumed ??= consumedCatalogEntries(
      JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')),
    );

    const before = parseCatalogs(workspaceFileAt(cwd, `${hash}^`));
    const after = parseCatalogs(workspaceFileAt(cwd, hash));

    return consumed.some(
      ([catalog, name]) => before[catalog]?.[name] !== after[catalog]?.[name],
    );
  }

  function skip(hash) {
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

    if (!verdicts.has(hash)) verdicts.set(hash, skip(hash));

    return verdicts.get(hash);
  };
}

const skips = new Map();

/**
 * The writer's `skip` for the package release-it runs in (its cwd).
 *
 * @param {{ hash?: string | null }} commit
 * @returns {boolean}
 */
export function skipUnconsumedCatalogCommit(commit) {
  const cwd = process.cwd();

  if (!skips.has(cwd)) skips.set(cwd, createCatalogCommitSkip(cwd));

  return skips.get(cwd)(commit);
}
