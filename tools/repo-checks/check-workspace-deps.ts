// The direction pnpm cannot fail on. An undeclared import does not resolve
// under isolated node_modules, so typecheck already catches it; a declared
// dependency nothing imports resolves fine forever. It is not free: turbo
// builds its package graph from these edges, so an unused one keeps its
// package downstream of a producer it never reads, and every task in it
// rehashes when that producer changes.
//
// Scoped to `workspace:*` deliberately. Registry dependencies reach a package
// through paths no scan sees — a plugin a config names by convention, a
// transitive peer, a type package tsc picks up from `types` — and the cache
// cost this exists to stop is a workspace edge either way.
import { readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { defaultExec } from '@tools/shared/exec.ts';
import { workspaceRoot } from '@tools/bootstrap/root.ts';
import {
  ROOT_DIR,
  loadWorkspace,
  type Member,
} from '@tools/shared/workspace.ts';

import {
  type Declaration,
  type Finding,
  type PackageSources,
  formatFindings,
  unusedDeps,
} from './workspace-deps.core.ts';

const CHECK = 'check-workspace-deps';

// Parsed for import specifiers. `.vue` and `.svelte` are read as text only —
// the TS pre-processor would see their template halves as garbage.
const MODULE = /\.(?:[cm]?ts|[cm]?js|tsx|jsx)$/;
// Everything else worth scanning for a package name.
const TEXT = /\.(?:json|jsonc|toml|ya?ml|md|vue|svelte|html|sh|bash)$/;

const DEP_BLOCKS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
] as const;

const { members } = await loadWorkspace(workspaceRoot);
const dirOf = (member: Member): string =>
  member.dir === ROOT_DIR ? '.' : member.dir;

// Tracked files only: an untracked scratch file must never make a dependency
// look used, and node_modules must never be walked at all.
const { stdout } = await defaultExec('git', ['ls-files', '-z'], {
  cwd: workspaceRoot,
});
const tracked = stdout.split('\0').filter((path) => path !== '');

// Longest dir first, so a nested member claims its own files rather than
// leaving them to the ancestor that also matches the prefix.
const byDepth = [...members].sort((a, b) => dirOf(b).length - dirOf(a).length);
const ownerOf = (path: string): Member | undefined =>
  byDepth.find(
    (member) =>
      dirOf(member) === '.' || path.startsWith(`${dirOf(member)}${sep}`),
  );

const files = new Map<string, string[]>();
for (const path of tracked) {
  const owner = ownerOf(path);
  if (owner === undefined) continue;
  if (!MODULE.test(path) && !TEXT.test(path)) continue;
  const list = files.get(owner.name);
  if (list === undefined) files.set(owner.name, [path]);
  else list.push(path);
}

const names = new Set(members.map((member) => member.name));

/** The binaries a workspace package publishes; a script may invoke these. */
const binsOf = new Map<string, string[]>();
for (const member of members) {
  const raw = await readFile(
    join(workspaceRoot, dirOf(member), 'package.json'),
    'utf8',
  ).catch(() => undefined);
  if (raw === undefined) continue;
  const bin: unknown = (JSON.parse(raw) as { bin?: unknown }).bin;
  const bins =
    typeof bin === 'string'
      ? [member.name.split('/').at(-1) ?? member.name]
      : bin !== null && typeof bin === 'object'
        ? Object.keys(bin)
        : [];
  binsOf.set(member.name, bins);
}

async function sourcesFor(member: Member): Promise<PackageSources> {
  const own = files.get(member.name) ?? [];
  const modules = new Map<string, string>();
  const other = new Map<string, string>();
  const miseRuns: string[] = [];
  for (const path of own) {
    const text = await readFile(join(workspaceRoot, path), 'utf8').catch(
      () => undefined,
    );
    if (text === undefined) continue;
    // The manifest is where the declaration lives, so reading it as evidence
    // would make every dependency vouch for itself.
    if (relative(dirOf(member), path) === 'package.json') continue;
    if (MODULE.test(path)) modules.set(path, text);
    else other.set(path, text);
    // mise task bodies are shell; whole-file rather than parsed, which can
    // only over-credit, and over-crediting is the safe direction here.
    if (path.endsWith('mise.toml')) miseRuns.push(text);
  }
  return {
    modules,
    other,
    scripts: Object.values(member.manifest?.scripts ?? {}),
    miseRuns,
  };
}

const findings: Finding[] = [];
let audited = 0;
for (const member of members) {
  const declared: Declaration[] = [];
  for (const block of DEP_BLOCKS) {
    for (const [name, range] of Object.entries(
      member.manifest?.[block] ?? {},
    )) {
      // `workspace:*` is the edge turbo reads; a catalog or registry range is
      // not this check's business even when the name happens to be a member.
      if (range.startsWith('workspace:') && names.has(name)) {
        declared.push({ name, block });
      }
    }
  }
  if (declared.length === 0) continue;
  audited += declared.length;
  findings.push(
    ...unusedDeps(
      member.name,
      declared,
      (name) => binsOf.get(name) ?? [],
      await sourcesFor(member),
    ),
  );
}

// A repo with no workspace edges would pass this vacuously; that is a broken
// derivation, not a clean bill.
if (audited === 0) {
  console.error(
    `${CHECK}: no workspace dependencies found — the scan is wrong`,
  );
  process.exit(1);
}

if (findings.length > 0) {
  console.error(`${CHECK}: ${formatFindings(findings)}`);
  process.exit(1);
}
console.log(`${CHECK}: ${audited} workspace dependencies, all used`);
