// Filtering for the CI Xvfb stderr capture: routine xkbcomp keysym warnings
// from the runner image are dropped; every other line is kept.
export const IGNORED_WARNINGS_PATTERN =
  /^> Warning:\s+Could not resolve keysym /;

// Yields the lines worth showing as they arrive; returns (as the generator's
// return value) the number of filtered keysym warnings.
export async function* filterStderr(lines) {
  let filtered = 0;
  for await (const line of lines) {
    if (IGNORED_WARNINGS_PATTERN.test(line)) {
      filtered += 1;
    } else if (line !== '') {
      yield line;
    }
  }
  return filtered;
}

export function formatFilteredCount(filtered) {
  return `(filtered ${filtered} 'Could not resolve keysym' warnings)`;
}
