// The two semver-range shapes the compat guards read out of the published peer
// ranges. Both are deliberately narrow: they only understand the shapes this
// repo actually publishes, and say no to everything else so a guard fails loudly
// rather than passing on a range it misread. See ranges.test.ts for the
// accepted/rejected examples.

// alternation, not a bare /\^2\./: a caret-2 comparator only counts at the start
// of the range or of a ` || ` alternative, never mid-token
const COVERS_MAJOR_2 = /(^|\|\| )\^2\./;

// caret floor = the literal version; widen deliberately if the range shape changes
const CARET_FLOOR = /^\^(\d+\.\d+\.\d+)$/;

/** Whether a peer range admits some lit 2.x, i.e. has a `^2.` comparator. */
export function coversMajor2(range: string): boolean {
  return COVERS_MAJOR_2.test(range);
}

/** Floor of a single-caret range; undefined when the shape isn't understood. */
export function caretFloor(range: string): string | undefined {
  return CARET_FLOOR.exec(range)?.[1];
}
