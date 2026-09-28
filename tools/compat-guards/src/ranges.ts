// The semver-range questions the compat guards ask of the published peer
// ranges. Every one of them fails closed on a range that constrains nothing,
// because a catalog range is configuration a human wrote: `*` is never a
// legitimate value there, and every answer derived from it is vacuous.
//
// That matters more than it looks. semver normalizes a whole family of inputs
// to `*` -- '', '||', 'x', '  ' -- so a typo in pnpm-workspace.yaml would
// otherwise come back as a confident answer about an unbounded range rather
// than as a guard failure. See ranges.test.ts for the accepted/rejected set.
import semver from 'semver';

// The single place the `*` family is recognized; adding a question to this
// module means routing it through here, not repeating the check.
function bounded(range: string): string | undefined {
  const normalized = semver.validRange(range);
  if (normalized === null || normalized === '*') return undefined;
  return normalized;
}

/** Whether the range names a bound at all; unreadable and `*` are both no. */
export function isBoundedRange(range: string): boolean {
  return bounded(range) !== undefined;
}

/** Whether a peer range admits some lit 2.x. */
export function coversMajor2(range: string): boolean {
  const normalized = bounded(range);
  if (normalized === undefined) return false;
  return semver.intersects(normalized, '^2.0.0');
}

/** Lowest version a range admits; undefined when semver can't name one. */
export function rangeFloor(range: string): string | undefined {
  const normalized = bounded(range);
  if (normalized === undefined) return undefined;
  return semver.minVersion(normalized)?.version;
}

/**
 * Every leg but the lowest, each as its own range; empty for a single-leg or
 * unbounded range. The floor alias proves the lowest leg; these need another proof.
 */
export function upperLegs(range: string): string[] {
  const floor = rangeFloor(range);
  if (floor === undefined) return [];
  const legs = new semver.Range(range).set.map((leg) =>
    leg.map((comparator) => comparator.value).join(' '),
  );
  const lowest = legs.findIndex(
    (leg) => semver.minVersion(leg)?.version === floor,
  );
  return legs.filter((_, index) => index !== lowest);
}
