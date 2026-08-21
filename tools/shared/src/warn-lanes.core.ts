// Pure logic for warn-only lanes: a task that exits 0 while emitting warnings.
// Two halves, both consumed outside this file:
//
//   1. the ratchet — an inventory of the warnings a lane currently emits,
//      diffed against a committed snapshot, so the floor cannot rise while the
//      warnings themselves are triaged item by item;
//   2. the marker — one line the lane prints into its own task log, which the
//      CI error summary parses back out.
//
// The marker exists because a warn-only lane is invisible to everything else
// we have: the error-summary step filters on a non-zero exitCode, and turbo's
// run summary carries only startTime/endTime/exitCode per task — a task with
// 36 warnings and one with zero are byte-identical in that JSON. So the state
// has to be *asserted* by the lane, and the task log is the one channel turbo
// replays verbatim on a cache hit.
//
// The IO — spawning the linter, reading and writing the snapshot file — lives
// in the repo-root `lint-elements.ts` shell.

/**
 * Turbo task ids whose warnings are watched. Explicit by necessity, not by
 * preference: warn-only-ness cannot be derived from a run summary (see above),
 * so the list is a design constraint. A lane joins it by printing the marker.
 */
export const WARN_WATCHED_LANES: readonly string[] = ['//#lint:elements'];

/** file (repo-relative, forward slashes) -> rule id -> warning count. */
export type WarnFiles = Record<string, Record<string, number>>;

/**
 * The committed floor. `rules` and `total` are derived from `files` and
 * committed anyway: they are what a reader scans, and `checkSnapshotIntegrity`
 * keeps them from drifting into fiction.
 */
export interface WarnSnapshot {
  /** The turbo task id this snapshot floors — matches a WARN_WATCHED_LANES entry. */
  task: string;
  total: number;
  rules: Record<string, number>;
  files: WarnFiles;
}

/** One lint message, narrowed to what the ratchet reads. */
export interface WarnMessage {
  file: string;
  line: number;
  column: number;
  /** null for a fatal parse error, which carries no rule. */
  ruleId: string | null;
  message: string;
  severity: 1 | 2;
}

export function tallyFiles(messages: readonly WarnMessage[]): WarnFiles {
  const files: WarnFiles = {};
  for (const { file, ruleId, severity } of messages) {
    if (severity !== 1) continue;
    // A warning with no rule id is a linter-level report, not a rule the
    // snapshot can key on; count it under a reserved name rather than "null".
    const rule = ruleId ?? '(no rule)';
    const byRule = (files[file] ??= {});
    byRule[rule] = (byRule[rule] ?? 0) + 1;
  }
  return sortFiles(files);
}

/** Stable key order so a regenerated snapshot diffs only where counts moved. */
export function sortFiles(files: WarnFiles): WarnFiles {
  const out: WarnFiles = {};
  for (const file of Object.keys(files).sort()) {
    const byRule = files[file] ?? {};
    const rules: Record<string, number> = {};
    for (const rule of Object.keys(byRule).sort()) {
      rules[rule] = byRule[rule] ?? 0;
    }
    out[file] = rules;
  }
  return out;
}

export function ruleTotals(files: WarnFiles): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const byRule of Object.values(files)) {
    for (const [rule, count] of Object.entries(byRule)) {
      totals[rule] = (totals[rule] ?? 0) + count;
    }
  }
  // Descending count, then rule id: the biggest block is the one being worked.
  return Object.fromEntries(
    Object.entries(totals).sort(
      ([aRule, aCount], [bRule, bCount]) =>
        bCount - aCount || aRule.localeCompare(bRule),
    ),
  );
}

export function totalWarnings(files: WarnFiles): number {
  let total = 0;
  for (const byRule of Object.values(files)) {
    for (const count of Object.values(byRule)) total += count;
  }
  return total;
}

export function buildSnapshot(task: string, files: WarnFiles): WarnSnapshot {
  const sorted = sortFiles(files);
  return {
    task,
    total: totalWarnings(sorted),
    rules: ruleTotals(sorted),
    files: sorted,
  };
}

/**
 * The committed derived fields, re-derived. A hand-edited snapshot whose
 * `total` no longer matches its `files` would quietly widen the floor by the
 * difference, so disagreement is a hard error, not a note.
 */
export function checkSnapshotIntegrity(snapshot: WarnSnapshot): string[] {
  const problems: string[] = [];
  const total = totalWarnings(snapshot.files);
  if (snapshot.total !== total) {
    problems.push(
      `snapshot total is ${snapshot.total} but files[] sums to ${total}`,
    );
  }
  const rules = ruleTotals(snapshot.files);
  for (const rule of new Set([
    ...Object.keys(rules),
    ...Object.keys(snapshot.rules),
  ])) {
    const committed = snapshot.rules[rule];
    const derived = rules[rule];
    if (committed !== derived) {
      problems.push(
        `snapshot rules[${rule}] is ${committed ?? 'absent'} but files[] sums to ${derived ?? 0}`,
      );
    }
  }
  return problems;
}

/** One (file, rule) pair whose count moved off the floor. */
export interface WarnDelta {
  file: string;
  rule: string;
  was: number;
  now: number;
}

export interface WarnDiff {
  /** New pairs, or pairs that grew — the ratchet's failure condition. */
  regressions: WarnDelta[];
  /** Pairs that shrank or vanished — the worklist draining. */
  improvements: WarnDelta[];
}

/**
 * Keyed per (file, rule), which is strictly stronger than a per-rule budget:
 * fixing one `anchor-is-valid` cannot free a slot for a new `alt-text`, and a
 * warning that merely moves between files is still a new entry where it lands.
 * Line numbers are deliberately out — they would churn the snapshot on every
 * unrelated edit above the warning.
 */
export function diffWarnings(
  snapshot: WarnFiles,
  observed: WarnFiles,
): WarnDiff {
  const regressions: WarnDelta[] = [];
  const improvements: WarnDelta[] = [];
  for (const file of new Set([
    ...Object.keys(snapshot),
    ...Object.keys(observed),
  ])) {
    const before = snapshot[file] ?? {};
    const after = observed[file] ?? {};
    for (const rule of new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ])) {
      const was = before[rule] ?? 0;
      const now = after[rule] ?? 0;
      if (now > was) regressions.push({ file, rule, was, now });
      else if (now < was) improvements.push({ file, rule, was, now });
    }
  }
  const order = (a: WarnDelta, b: WarnDelta): number =>
    a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule);
  return {
    regressions: regressions.sort(order),
    improvements: improvements.sort(order),
  };
}

export type WarnLaneStatus = 'at-floor' | 'below-floor' | 'above-floor';

export function statusOf(total: number, floor: number): WarnLaneStatus {
  if (total > floor) return 'above-floor';
  if (total < floor) return 'below-floor';
  return 'at-floor';
}

/** What the lane asserts about itself, for readers that never see its stdout. */
export interface WarnLaneState {
  task: string;
  /** Warnings observed this run. */
  total: number;
  /** Warnings the committed snapshot allows. */
  floor: number;
  status: WarnLaneStatus;
  /**
   * (file, rule) pairs that are new or grew. Carried separately from `status`
   * because the two disagree in exactly the case the snapshot exists for: a
   * fix that funds a new warning leaves the total — and so the status — flat.
   */
  regressions: number;
  rules: Record<string, number>;
}

const MARKER = 'warn-lane:';

/**
 * A single line, JSON payload, because the consumer is a parser and prose is
 * not a protocol. The human-readable report is the rest of the lane's stdout.
 */
export function formatWarnLaneMarker(state: WarnLaneState): string {
  return `${MARKER} ${JSON.stringify(state)}`;
}

export function parseWarnLaneMarker(line: string): WarnLaneState | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith(MARKER)) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(trimmed.slice(MARKER.length));
  } catch {
    return undefined;
  }
  const state = value as WarnLaneState;
  if (typeof state?.task !== 'string' || typeof state?.total !== 'number') {
    return undefined;
  }
  return state;
}

/** The last marker in a task log — a lane prints exactly one, at the end. */
export function findWarnLaneState(log: string): WarnLaneState | undefined {
  const lines = log.split('\n');
  for (let index = lines.length - 1; index >= 0; index--) {
    const state = parseWarnLaneMarker(lines[index] ?? '');
    if (state !== undefined) return state;
  }
  return undefined;
}

/**
 * The one line a warn lane contributes to the CI failure report. A lane that
 * ran green still gets a line: "silently green" is the condition this whole
 * mechanism exists to end.
 */
export function warnLaneLine(
  task: string,
  state: WarnLaneState | undefined,
): string {
  if (state === undefined) {
    return `${task} — warn-only lane, no state in this run (task did not run, or predates the marker)`;
  }
  const top = Object.entries(state.rules)
    .slice(0, 3)
    .map(([rule, count]) => `${rule} ${count}`)
    .join(', ');
  const detail = top === '' ? '' : ` — ${top}`;
  if ((state.regressions ?? 0) > 0) {
    const count = state.regressions;
    return `${task} — ${count} warning entr${count === 1 ? 'y' : 'ies'} not in the snapshot (${state.total} warnings, floor ${state.floor})${detail}`;
  }
  const verdict =
    state.status === 'above-floor'
      ? `${state.total} warnings, ABOVE the snapshot floor of ${state.floor}`
      : state.status === 'below-floor'
        ? `${state.total} warnings, ${state.floor - state.total} below the snapshot floor — the snapshot is stale`
        : `${state.total} warnings, at the snapshot floor`;
  return `${task} — ${verdict}${detail}`;
}
