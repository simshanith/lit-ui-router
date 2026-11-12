import { execFileSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse } from 'yaml';

import {
  consumedCatalogEntries,
  parseCatalogs,
  WORKSPACE_FILE,
  workspaceFileAt,
} from './catalog-commits.js';

// Short scopes that name packages; one may name several.
export const SCOPE_ALIASES = {
  'eslint-plugin': ['eslint-plugin-lit-ui-router'],
  mobx: ['lit-ui-router-mobx', 'ui-router-mobx'],
  server: ['ui-router-server'],
  signals: ['lit-ui-router-signals', 'ui-router-signals'],
  ssr: ['lit-ui-router-ssr'],
};

// The packed manifest fields; scripts and devDependencies never ship.
const SHIPPED_FIELDS = [
  'bin',
  'dependencies',
  'engines',
  'exports',
  'files',
  'imports',
  'main',
  'module',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
  'sideEffects',
  'type',
  'types',
];

const SHIPPED_SOURCE =
  /^(?:src|bin)\/(?!(?:.*\/)?specs?\/)(?!.*\.(?:spec|test)\.[cm]?[jt]sx?$)/;

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function showAt(cwd, rev, path) {
  try {
    return git(cwd, 'show', `${rev}:${path}`);
  } catch {
    // a root commit, or a revision that predates the file
    return undefined;
  }
}

/**
 * @typedef {{ packages: Map<string, string[]>; others: Set<string> }} ScopeWords
 */

/**
 * Scope words from the workspace globs at `root`: published packages by npm
 * name and directory, every other member by name, directory and top-level
 * folder. `@repo/*` source is inlined into dist, so its scopes stay neutral.
 *
 * @param {string} root
 * @returns {ScopeWords}
 */
export function workspaceScopes(root) {
  let source;

  try {
    source = readFileSync(join(root, WORKSPACE_FILE), 'utf8');
  } catch {
    source = undefined;
  }

  const globs = (source === undefined ? undefined : parse(source))?.packages;
  const packages = new Map();
  const others = new Set();

  const add = (scope, name) =>
    packages.set(scope, [...(packages.get(scope) ?? []), name]);

  for (const manifestPath of (globs ?? []).flatMap((glob) =>
    globSync(`${glob}/package.json`, { cwd: root }),
  )) {
    const dir = dirname(manifestPath);
    const manifest = JSON.parse(readFileSync(join(root, manifestPath), 'utf8'));
    const name = manifest.name ?? basename(dir);

    if (name.startsWith('@repo/')) continue;

    if (dir.startsWith('packages/') && manifest.private !== true) {
      add(name, name);
      add(basename(dir), name);
    } else {
      others.add(name.replace(/^@[^/]+\//, ''));
      others.add(basename(dir));
      others.add(dir.split('/')[0]);
    }
  }

  for (const [alias, names] of Object.entries(SCOPE_ALIASES)) {
    for (const name of names) add(alias, name);
  }

  for (const scope of packages.keys()) others.delete(scope);

  return { packages, others };
}

/**
 * `own` when a scope names the package, `foreign` when it names only other
 * workspace members, `neutral` when unscoped or naming none (`deps`).
 *
 * @param {string | null | undefined} scope
 * @param {string} packageName
 * @param {ScopeWords} words
 * @returns {'own' | 'foreign' | 'neutral'}
 */
export function classifyScope(scope, packageName, words) {
  const scopes = (scope ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (scopes.some((s) => words.packages.get(s)?.includes(packageName))) {
    return 'own';
  }

  if (scopes.some((s) => words.packages.has(s) || words.others.has(s))) {
    return 'foreign';
  }

  return 'neutral';
}

function shippedFieldChanged(cwd, hash) {
  const before = JSON.parse(showAt(cwd, `${hash}^`, './package.json') ?? '{}');
  const after = JSON.parse(showAt(cwd, hash, './package.json') ?? '{}');

  return SHIPPED_FIELDS.some(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}

/**
 * Whether a commit changed what the package at `cwd` packs: its source, a
 * shipped manifest field, or a catalog entry its shipped fields consume.
 *
 * @param {string} cwd
 * @param {string} hash
 * @param {Record<string, Record<string, string> | undefined>} manifest the package's manifest
 */
export function changesShippedCode(cwd, hash, manifest) {
  const files = git(
    cwd,
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '--relative',
    '--root',
    '-r',
    hash,
    '--',
    '.',
  )
    .split('\n')
    .filter(Boolean);

  if (files.some((file) => SHIPPED_SOURCE.test(file))) return true;

  if (files.includes('package.json') && shippedFieldChanged(cwd, hash)) {
    return true;
  }

  const before = parseCatalogs(workspaceFileAt(cwd, `${hash}^`));
  const after = parseCatalogs(workspaceFileAt(cwd, hash));

  return consumedCatalogEntries(manifest).some(
    ([catalog, name]) => before[catalog]?.[name] !== after[catalog]?.[name],
  );
}

/**
 * The manifest at `rev` with its `catalog:` peer specs resolved through the
 * catalogs of that revision, as the packed manifest carries them.
 *
 * @param {string} cwd the package directory
 * @param {string} rev
 */
export function resolvedManifestAt(cwd, rev) {
  const source = showAt(cwd, rev, './package.json');

  if (source === undefined) {
    throw new Error(`no package.json at ${rev} in ${cwd}`);
  }

  return resolveCatalogSpecs(
    JSON.parse(source),
    parseCatalogs(workspaceFileAt(cwd, rev)),
  );
}

/**
 * @param {Record<string, any>} manifest
 * @param {Record<string, Record<string, string>>} catalogs
 */
export function resolveCatalogSpecs(manifest, catalogs) {
  const peers = Object.entries(manifest.peerDependencies ?? {}).map(
    ([name, spec]) => {
      if (!spec.startsWith('catalog:')) return [name, spec];

      const catalog = spec.slice('catalog:'.length) || 'default';
      const range = catalogs[catalog]?.[name];

      if (range === undefined) {
        throw new Error(`${name}: ${spec} names no catalog entry`);
      }

      return [name, range];
    },
  );

  return { ...manifest, peerDependencies: Object.fromEntries(peers) };
}
