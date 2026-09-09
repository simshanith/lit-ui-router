// A declared workspace dependency nothing uses. pnpm's isolated node_modules
// already fences the other direction — importing a package you did not declare
// does not resolve, so typecheck fails — but nothing reads the declarations
// themselves, and an unused one is invisible precisely because it costs no
// error. It costs cache: turbo derives its package graph from these edges, so
// every task in the declaring package rehashes whenever the unused dependency
// changes.
//
// Evidence is gathered permissively on purpose. A gate that cries wolf gets
// suppressed, so anything that plausibly reads as use counts as use, and the
// check only fires when a dependency appears nowhere at all.

import ts from 'typescript-6';

/** A workspace dependency and the block it was declared in. */
export type Declaration = { name: string; block: string };

/** One package's evidence: its own files, already read. */
export type PackageSources = {
  /** Sources parsed for import specifiers; keyed by path for the report. */
  modules: Map<string, string>;
  /** Everything else tracked in the package — configs, manifests, docs. */
  other: Map<string, string>;
  /** `scripts` values from the package's own manifest. */
  scripts: string[];
  /** `run` values from the package's mise tasks. */
  miseRuns: string[];
};

/** What made a dependency count as used; `undefined` when nothing did. */
export type Evidence = { kind: string; where: string };

/**
 * The package a specifier names, or undefined for anything that is not a bare
 * package import. `@scope/name/deep.ts` is `@scope/name`; `name/sub` is `name`.
 */
export function packageOf(specifier: string): string | undefined {
  if (specifier.startsWith('.') || specifier.startsWith('/')) return undefined;
  if (specifier.startsWith('node:') || specifier.startsWith('#')) {
    return undefined;
  }
  const parts = specifier.split('/');
  if (specifier.startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : undefined;
  }
  return parts[0];
}

/**
 * Every specifier the loader can reach: static and dynamic `import`,
 * `export ... from`, `require`, side-effect imports. Type-only imports are in
 * here too, and they count — a type import still needs the dependency
 * declared. TS 6 rather than the repo's TS 7 because 7 ships no JS API.
 */
export function importedPackages(source: string): Set<string> {
  const found = new Set<string>();
  for (const { fileName } of ts.preProcessFile(source, true, true)
    .importedFiles) {
    const name = packageOf(fileName);
    if (name !== undefined) found.add(name);
  }
  return found;
}

// A package is reached by more than an import: `import.meta.resolve`, a
// `node_modules/<name>/dist` path in a bundler config, a binary in a script.
// Rather than enumerate those, any occurrence of the name counts, bounded so
// `foo` does not match `foo-bar`. That credits a bare mention in a comment
// too, which is the deliberate direction — a check that fires on a package
// someone does use is a check people learn to override.
const mentions = (name: string): RegExp =>
  new RegExp(`(?<![\\w-])${name.replaceAll('/', '\\/')}(?![\\w-])`);

/** A whole-word match, for binary names in a shell command. */
const invoked = (bin: string): RegExp =>
  new RegExp(`(?:^|[\\s;&|(])${bin.replaceAll('.', '\\.')}(?:$|[\\s;&|)])`);

/**
 * Why `name` counts as used by this package, or undefined if nothing shows it.
 * `bins` are the binary names the dependency publishes, which a script may
 * invoke with no import anywhere.
 */
export function evidenceFor(
  name: string,
  bins: readonly string[],
  sources: PackageSources,
): Evidence | undefined {
  for (const [path, text] of sources.modules) {
    if (importedPackages(text).has(name))
      return { kind: 'import', where: path };
  }
  const literal = mentions(name);
  for (const [path, text] of [...sources.modules, ...sources.other]) {
    if (literal.test(text)) return { kind: 'reference', where: path };
  }
  for (const bin of bins) {
    const word = invoked(bin);
    for (const script of sources.scripts) {
      if (word.test(script)) return { kind: 'bin', where: `script: ${bin}` };
    }
    for (const run of sources.miseRuns) {
      if (word.test(run)) return { kind: 'bin', where: `mise: ${bin}` };
    }
  }
  return undefined;
}

/** One package's unused declarations, in declaration order. */
export type Finding = { pkg: string; dep: Declaration };

/** The declarations in `declared` that `sources` shows no use of. */
export function unusedDeps(
  pkg: string,
  declared: readonly Declaration[],
  binsOf: (name: string) => readonly string[],
  sources: PackageSources,
): Finding[] {
  return declared
    .filter(
      (dep) => evidenceFor(dep.name, binsOf(dep.name), sources) === undefined,
    )
    .map((dep) => ({ pkg, dep }));
}

/** The failure message: what to delete, and why it is not free to leave. */
export function formatFindings(findings: readonly Finding[]): string {
  const lines = findings.map(
    ({ pkg, dep }) =>
      `  ${pkg}: ${dep.name} (${dep.block}) — declared, never used`,
  );
  return [
    `${findings.length} unused workspace ${
      findings.length === 1 ? 'dependency' : 'dependencies'
    }:`,
    ...lines,
    '',
    'Each one puts its package downstream of a producer it does not read, so',
    'turbo rehashes every task here whenever that producer changes. Delete the',
    'entry and run `pnpm install`. If the dependency is genuinely used in a way',
    'nothing above detects, that path is worth a comment naming it.',
  ].join('\n');
}
