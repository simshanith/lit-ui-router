// Pure logic for the static-edges-vs-dynamic-discovery guard: a turbo task
// that must order on a task of every workspace member matching a predicate
// (docs:api producers, publishable packs, d.ts for the template lint). The
// members are discovered at run time; the edges are static turbo.json lines,
// so a new member silently falls out of the graph unless something compares
// the two. The IO (workspace load, turbo dry-run) lives in check-graph-edges.ts.

/** A consumer task that must depend on `<member>#<producerTask>` for every selected member. */
export type EdgeRule = {
  consumer: string;
  producerTask: string;
  /** Why these members, in the words a maintainer needs to add the next line. */
  why: string;
};

/** Selected member names whose `<name>#<producerTask>` is absent from `resolved`. */
export function missingEdges(
  members: readonly string[],
  producerTask: string,
  resolved: readonly string[],
): string[] {
  const declared = new Set(resolved);
  return members
    .filter((name) => !declared.has(`${name}#${producerTask}`))
    .sort();
}

/** Error text naming the exact dependsOn lines to add. */
export function formatMissing(
  rule: EdgeRule,
  missing: readonly string[],
): string {
  const lines = missing
    .map((name) => `"${name}#${rule.producerTask}"`)
    .join(', ');
  return `${rule.consumer} does not order on ${lines}: ${rule.why}`;
}
