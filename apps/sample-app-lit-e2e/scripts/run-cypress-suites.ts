import { concurrently, type CloseEvent } from 'concurrently';

// The five Cypress suites share one dev server (started by `test` via
// start-server-and-test), so running them concurrently is pure wall-clock win.
// concurrently already fails the run when any suite exits non-zero; this wrapper
// adds a per-suite timing table and an unambiguous PASS/FAIL banner on top, and
// propagates the failure through process.exitCode.
const suites = [
  { name: 'vanilla', command: 'pnpm run test:cypress' },
  { name: 'mobx', command: 'pnpm run test:cypress:mobx' },
  { name: 'docs', command: 'pnpm run test:cypress:docs' },
  { name: 'hash', command: 'pnpm run test:cypress:hash' },
  { name: 'navigation', command: 'pnpm run test:cypress:navigation' },
];

const passed = (event: CloseEvent) => event.exitCode === 0;

function summarize(events: CloseEvent[]): void {
  if (events.length === 0) {
    console.error('\n✗ e2e tests failed — no Cypress suites spawned\n');
    process.exitCode = 1;
    return;
  }

  const ordered = [...events].sort((a, b) => a.index - b.index);
  const failures = ordered.filter((event) => !passed(event));
  const nameWidth = Math.max(
    ...ordered.map((event) => event.command.name.length),
  );
  // True wall clock across the concurrent run, not the sum of suite durations.
  const startMs = Math.min(
    ...ordered.map((event) => event.timings.startDate.getTime()),
  );
  const endMs = Math.max(
    ...ordered.map((event) => event.timings.endDate.getTime()),
  );
  const wall = `${((endMs - startMs) / 1000).toFixed(1)}s`;

  console.log('\ne2e cypress suites:');
  for (const event of ordered) {
    const mark = passed(event) ? '✓' : '✗';
    const name = event.command.name.padEnd(nameWidth);
    const secs = `${event.timings.durationSeconds.toFixed(1)}s`.padStart(7);
    const detail = passed(event) ? '' : `  (exit ${event.exitCode})`;
    console.log(`  ${mark} ${name}  ${secs}${detail}`);
  }

  if (failures.length === 0) {
    console.log(
      `\n✓ e2e tests passed — ${ordered.length}/${ordered.length} suites in ${wall}\n`,
    );
  } else {
    console.log(
      `\n✗ e2e tests failed — ${failures.length}/${ordered.length} suites failed in ${wall}\n`,
    );
    process.exitCode = 1;
  }
}

try {
  summarize(await concurrently(suites, { prefixColors: 'auto' }).result);
} catch (reason) {
  // concurrently rejects with the CloseEvent[] on suite failure; anything else
  // (e.g. a spawn error) is a genuine harness failure.
  if (Array.isArray(reason)) {
    summarize(reason as CloseEvent[]);
  } else {
    console.error('\n✗ e2e tests failed to run:', reason);
    process.exitCode = 1;
  }
}
