import manifest from '../package.json' with { type: 'json' };

// The e2e suite set, dependency-free so CI's plan job reads it without an
// install: this package's own `test:e2e:*` scripts, never a list.

export const PREFIX = 'test:e2e:';

// sorted to keep the command string stable: it is the run's identity in the
// summary, and an unstable one reads as a different run each time
export const suites: string[] = Object.keys(manifest.scripts)
  .filter((name) => name.startsWith(PREFIX))
  .map((name) => name.slice(PREFIX.length))
  .sort();

// Run only when named: the Acceptance workflow runs the axe pass on its own runner.
const NAMED_ONLY = ['a11y'];

/** What a bare run selects, and what CI's e2e matrix covers. */
export const defaultSuites: string[] = suites.filter(
  (suite) => !NAMED_ONLY.includes(suite),
);

/** `names` in order, `perGroup` at a time; the last group takes the remainder. */
export function groupSuites(
  names: readonly string[],
  perGroup: number,
): string[][] {
  if (!Number.isInteger(perGroup) || perGroup < 1) {
    throw new RangeError(
      `suites per group must be a positive integer, got ${perGroup}`,
    );
  }

  const groups: string[][] = [];

  for (let start = 0; start < names.length; start += perGroup) {
    groups.push(names.slice(start, start + perGroup));
  }

  return groups;
}
