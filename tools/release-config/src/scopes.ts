import { execFileSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { parse } from 'yaml';

import {
  type Catalogs,
  consumedCatalogEntries,
  parseCatalogs,
  WORKSPACE_FILE,
  workspaceFileAt,
} from './catalog-commits.ts';
import type { PeerManifest } from './peer-changes.ts';

// Short scopes that name packages; one may name several.
export const SCOPE_ALIASES = {
  'eslint-plugin': ['eslint-plugin-lit-ui-router'],
  mobx: ['lit-ui-router-mobx', 'ui-router-mobx'],
  server: ['ui-router-server'],
  signals: ['lit-ui-router-signals', 'ui-router-signals'],
  ssr: ['lit-ui-router-ssr'],
} as const satisfies Record<string, readonly string[]>;

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

/** The manifest fields the notes read; the rest pass through untouched. */
export interface PackageManifest extends PeerManifest {
  name?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface ScopeWords {
  packages: Map<string, string[]>;
  others: Set<string>;
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function showAt(cwd: string, rev: string, path: string): string | undefined {
  try {
    return git(cwd, 'show', `${rev}:${path}`);
  } catch {
    // a root commit, or a revision that predates the file
    return undefined;
  }
}

/**
 * Scope words from the workspace globs at `root`: published packages by npm
 * name and directory, every other member by name, directory and top-level
 * folder. `@repo/*` source is inlined into dist, so its scopes stay neutral.
 */
export function workspaceScopes(root: string): ScopeWords {
  let source: string | undefined;

  try {
    source = readFileSync(join(root, WORKSPACE_FILE), 'utf8');
  } catch {
    source = undefined;
  }

  // SAFETY: pnpm-workspace.yaml is a mapping whose `packages` is a glob list
  const workspace = (source === undefined ? undefined : parse(source)) as
    | { packages?: string[] }
    | undefined;

  const packages = new Map<string, string[]>();
  const others = new Set<string>();

  const add = (scope: string, name: string) =>
    packages.set(scope, [...(packages.get(scope) ?? []), name]);

  for (const manifestPath of (workspace?.packages ?? []).flatMap((glob) =>
    globSync(`${glob}/package.json`, { cwd: root }),
  )) {
    const dir = dirname(manifestPath);

    // SAFETY: a package.json is a JSON object and every declared field is optional
    const manifest = JSON.parse(
      readFileSync(join(root, manifestPath), 'utf8'),
    ) as PackageManifest;

    const name = manifest.name ?? basename(dir);

    if (name.startsWith('@repo/')) continue;

    if (dir.startsWith('packages/') && manifest.private !== true) {
      add(name, name);
      add(basename(dir), name);
    } else {
      others.add(name.replace(/^@[^/]+\//, ''));
      others.add(basename(dir));
      others.add(dir.split('/')[0] ?? dir);
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
 */
export function classifyScope(
  scope: string | null | undefined,
  packageName: string,
  words: ScopeWords,
): 'own' | 'foreign' | 'neutral' {
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

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function manifestAt(cwd: string, rev: string): Record<string, Json> {
  // SAFETY: a package.json is a JSON object
  return JSON.parse(showAt(cwd, rev, './package.json') ?? '{}') as Record<
    string,
    Json
  >;
}

function shippedFieldChanged(cwd: string, hash: string): boolean {
  const before = manifestAt(cwd, `${hash}^`);
  const after = manifestAt(cwd, hash);

  return SHIPPED_FIELDS.some(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}

/**
 * Whether a commit changed what the package at `cwd` packs: its source, a
 * shipped manifest field, or a catalog entry its shipped fields consume.
 */
export function changesShippedCode(
  cwd: string,
  hash: string,
  manifest: PackageManifest,
): boolean {
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

  const { dependencies, peerDependencies, optionalDependencies } = manifest;

  return consumedCatalogEntries({
    dependencies,
    peerDependencies,
    optionalDependencies,
  }).some(
    ([catalog, name]) => before[catalog]?.[name] !== after[catalog]?.[name],
  );
}

/**
 * The manifest at `rev` with its `catalog:` peer specs resolved through the
 * catalogs of that revision, as the packed manifest carries them.
 *
 * @param cwd the package directory
 */
export function resolvedManifestAt(cwd: string, rev: string): PackageManifest {
  const source = showAt(cwd, rev, './package.json');

  if (source === undefined) {
    throw new Error(`no package.json at ${rev} in ${cwd}`);
  }

  return resolveCatalogSpecs(
    // SAFETY: a package.json is a JSON object and every declared field is optional
    JSON.parse(source) as PackageManifest,
    parseCatalogs(workspaceFileAt(cwd, rev)),
  );
}

/** The manifest with its `catalog:` peer specs replaced by their ranges. */
export function resolveCatalogSpecs(
  manifest: PackageManifest,
  catalogs: Catalogs,
): PackageManifest {
  const peers = Object.entries(manifest.peerDependencies ?? {}).map(
    ([name, spec]): [string, string] => {
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
