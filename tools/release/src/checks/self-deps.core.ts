// Pure logic for the static-edges-vs-dynamic-discovery guard: pack:all hashes
// the packed packages through package-qualified `<name>#build` edges in
// tools/release/turbo.json — an undeclared publishable package would get
// stale cached verdicts. The IO (reading turbo.json) lives in ./self-deps.ts.

/** Publishable member names whose `<name>#build` is absent from `packAllDeps`. */
export function undeclaredMembers(
  publishable: string[],
  packAllDeps: string[],
): string[] {
  const declared = new Set(packAllDeps);
  return publishable.filter((name) => !declared.has(`${name}#build`)).sort();
}

/** Error text telling the maintainer exactly which edges to add. */
export function formatUndeclared(missing: string[]): string {
  return (
    `publishable package(s) not ordered by tools/release/turbo.json pack:all: ${missing.join(', ')}. ` +
    `Add ${missing.map((name) => `"${name}#build"`).join(', ')} to its dependsOn — ` +
    'check:pack and check:published-diff hash packed packages through that edge, so an ' +
    'undeclared package silently gets stale cached verdicts.'
  );
}
