// The two semver-range questions the compat guards ask of the published peer
// ranges. Both fail closed: an empty or malformed range is a no, never a yes,
// so a guard reports its own error rather than passing on a range semver would
// have read as `*`. See ranges.test.ts for the accepted/rejected examples.
import semver from 'semver';

// semver reads '' as '*'; both predicates would otherwise fail open on it
function isBlank(range: string): boolean {
  return range.trim() === '';
}

/** Whether semver can read the range at all; blank is a no, not `*`. */
export function isReadableRange(range: string): boolean {
  return !isBlank(range) && semver.validRange(range) !== null;
}

/** Whether a peer range admits some lit 2.x. */
export function coversMajor2(range: string): boolean {
  if (isBlank(range)) return false;
  try {
    return semver.intersects(range, '^2.0.0');
  } catch {
    return false;
  }
}

/** Lowest version a range admits; undefined when semver can't name one. */
export function rangeFloor(range: string): string | undefined {
  if (isBlank(range)) return undefined;
  try {
    return semver.minVersion(range)?.version;
  } catch {
    return undefined;
  }
}
