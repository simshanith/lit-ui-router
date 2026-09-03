// Pure logic for check-graph-edges.ts, which owns the IO.

/** A consumer task that must depend on `<member>#<producerTask>` for every selected member. */
export type EdgeRule = {
  consumer: string;
  producerTask: string;
  /** Why these members. */
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
