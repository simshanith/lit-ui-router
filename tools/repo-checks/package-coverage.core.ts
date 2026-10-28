// Pure logic for check-package-coverage.ts, which owns the IO.

/** The turbo umbrellas a package joins by defining the task or one of its leaves. */
export const TASKS = [
  'build',
  'typecheck',
  'lint',
  'test',
  'format:check',
] as const;

export type Task = (typeof TASKS)[number];

/**
 * File patterns of an `eslint [--format <name>] <pattern>...` script. Any
 * other flag throws: a half-understood command would check the wrong set.
 */
export function parseLintPatterns(command: string): string[] {
  const [bin, ...args] = (command.match(/"[^"]*"|\S+/g) ?? []).map((token) =>
    token.replace(/^"(.*)"$/, '$1'),
  );

  if (bin !== 'eslint') throw new Error(`not an eslint call: ${command}`);
  const patterns: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? '';

    if (arg === '--format') i++;
    else if (arg.startsWith('-'))
      throw new Error(`unhandled eslint flag ${arg} in: ${command}`);
    else patterns.push(arg);
  }

  if (patterns.length === 0) throw new Error(`no file patterns in: ${command}`);

  return patterns;
}

/** A tracked manifest the lane leaves out on purpose. */
export type Exclusion = { file: string; why: string };

export type CoverageAudit = {
  /** Tracked, not excluded, not linted. */
  missing: string[];
  /** Linted, but untracked or excluded. */
  extra: string[];
  /** Excluded entries that are no longer tracked manifests. */
  stale: string[];
};

export function auditCoverage(
  tracked: readonly string[],
  linted: readonly string[],
  excluded: readonly Exclusion[],
): CoverageAudit {
  const skip = new Set(excluded.map(({ file }) => file));
  const expected = tracked.filter((file) => !skip.has(file));
  const lintedSet = new Set(linted);
  const expectedSet = new Set(expected);
  const trackedSet = new Set(tracked);

  return {
    missing: expected.filter((file) => !lintedSet.has(file)),
    extra: linted.filter((file) => !expectedSet.has(file)),
    stale: [...skip].filter((file) => !trackedSet.has(file)),
  };
}

/** The umbrellas a scripts block reaches: `task` itself or a `task:*` leaf. */
export function scriptTasks(scripts: Record<string, string> = {}): Set<Task> {
  const names = Object.keys(scripts);

  return new Set(
    TASKS.filter((task) =>
      names.some((name) => name === task || name.startsWith(`${task}:`)),
    ),
  );
}

/** One row of the coverage view: a tracked package.json. */
export type CoverageRow = {
  dir: string;
  name: string;
  /** `linted`, or `excluded` for an EXCLUDED entry. */
  eslint: 'linted' | 'excluded' | 'MISSING';
  /** `root`, `member`, or `-` for a standalone project. */
  member: 'root' | 'member' | '-';
  catalog: boolean;
  tasks: Set<Task>;
};

const MARK = { yes: '✓', no: '-' } as const;

/** Space-aligned columns, header first; plain text so any log renders it. */
export function formatCoverage(rows: readonly CoverageRow[]): string[] {
  const header = ['dir', 'name', 'eslint', 'member', 'catalog', ...TASKS];

  const cells = rows.map((row) => [
    row.dir,
    row.name,
    row.eslint,
    row.member,
    row.catalog ? MARK.yes : MARK.no,
    ...TASKS.map((task) => (row.tasks.has(task) ? MARK.yes : MARK.no)),
  ]);

  const widths = header.map((title, column) =>
    Math.max(title.length, ...cells.map((cell) => (cell[column] ?? '').length)),
  );

  return [header, ...cells].map((cell) =>
    cell
      .map((value, column) => value.padEnd(widths[column] ?? 0))
      .join('  ')
      .trimEnd(),
  );
}
