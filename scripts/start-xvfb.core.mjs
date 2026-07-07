// Filtering for the CI Xvfb stderr capture: routine xkbcomp keysym warnings
// from the runner image are dropped; every other line is kept.
export const IGNORED_WARNINGS_PATTERN =
  /^> Warning:\s+Could not resolve keysym /;

export async function filterStderr(lines) {
  const kept = [];
  let filtered = 0;
  for await (const line of lines) {
    if (IGNORED_WARNINGS_PATTERN.test(line)) {
      filtered += 1;
    } else if (line !== '') {
      kept.push(line);
    }
  }
  return { kept, filtered };
}

export function formatFailure({ kept, filtered }) {
  return [
    'Xvfb failed to start:',
    ...kept,
    `(filtered ${filtered} 'Could not resolve keysym' warnings)`,
  ].join('\n');
}
