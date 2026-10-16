import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type FormatFinding,
  FORMAT_FILE_LIMIT,
  extractFormatFindings,
  formatAnnotation,
  formattingLines,
  formattingMarkdown,
  formattingTier,
  parseHunks,
  parseOxfmtFiles,
  parseTaploFiles,
} from './format-annotations.core.ts';
import {
  type RunSummary,
  type SummaryTask,
  type ToolAnnotation,
  ANNOTATION_LIMIT,
  planAnnotations,
} from './run-summary.core.ts';

const ESC = '\u001B';

// Captured from `turbo run format:check:oxfmt --filter=@tools/build_and_test` with two lines of start-xvfb.core.ts respaced.
const oxfmtOne = [
  '$ oxfmt --check "**/*.{ts,js,json,jsonc,md}"',
  'Checking formatting...',
  '',
  'src/start-xvfb.core.ts (0ms)',
  '',
  'Format issues found in above 1 files. Run without `--check` to fix.',
  'Finished in 6ms on 19 files using 10 threads.',
  '[ELIFECYCLE] Command failed with exit code 1.',
].join('\n');

// Captured from `turbo run format:check --continue`, four files in one package.
const oxfmtMany = [
  '$ oxfmt --check "**/*.{ts,js,json,jsonc,md}"',
  'Checking formatting...',
  '',
  'src/bench-summary.core.ts (0ms)',
  'src/format-annotations.core.ts (0ms)',
  'src/run-summary.ts (1ms)',
  'src/start-xvfb.core.ts (0ms)',
  '',
  'Format issues found in above 4 files. Run without `--check` to fix.',
  'Finished in 4ms on 20 files using 10 threads.',
  '[ELIFECYCLE] Command failed with exit code 1.',
].join('\n');

const oxfmtGreen = [
  'Checking formatting...',
  '',
  'All matched files use the correct format.',
  'Finished in 3ms on 16 files using 10 threads.',
].join('\n');

// Captured from `turbo run //#format:check:toml` with a header line padded; root shortened to /repo.
const taploLog = [
  '$ mise run format_check_toml',
  '[//:format_check_toml] $ mise run taplo fmt --check',
  '[//:taplo] $ ~/repo/.config/mise/tasks/taplo fmt --check',
  ' INFO taplo:format_files:load_config: found configuration file path="/repo/.config/taplo.toml"',
  ' INFO taplo:format_files:collect_files: found files total=7 excluded=0 files=["/repo/.config/mise/config.toml", "/repo/tools/build_and_test/mise.toml"] cwd="/repo"',
  'ERROR taplo:format_files: the file is not properly formatted path="/repo/tools/build_and_test/mise.toml"',
  'ERROR operation failed error=some files were not properly formatted',
  '[//:taplo] ERROR task failed',
  '[//:format_check_toml] ERROR task failed',
  '[ELIFECYCLE] Command failed with exit code 1.',
].join('\n');

// `git diff --no-index -U0` of the respaced start-xvfb.core.ts against oxfmt's stdout.
const xvfbDiff = [
  'diff --git a/tools/build_and_test/src/start-xvfb.core.ts b/tmp/0',
  '--- a/tools/build_and_test/src/start-xvfb.core.ts',
  '+++ b/tmp/0',
  '@@ -4 +4 @@',
  '-      /^> Warning:\\s+Could not resolve keysym /;',
  '+  /^> Warning:\\s+Could not resolve keysym /;',
  '@@ -11 +11 @@',
  '-  let   filtered=0;',
  '+  let filtered = 0;',
].join('\n');

function task(over: Partial<SummaryTask>): SummaryTask {
  return {
    taskId: '@tools/build_and_test#format:check:oxfmt',
    task: 'format:check:oxfmt',
    package: '@tools/build_and_test',
    directory: 'tools/build_and_test',
    command: 'oxfmt --check "**/*.{ts,js,json,jsonc,md}"',
    execution: { startTime: 0, endTime: 1, exitCode: 1 },
    ...over,
  };
}

function summary(tasks: SummaryTask[]): RunSummary {
  return {
    id: 'run-id',
    turboVersion: '2.11.8',
    execution: {
      command: 'turbo run format:check',
      success: 0,
      failed: tasks.length,
      cached: 0,
      attempted: tasks.length,
      startTime: 0,
      endTime: 1,
      exitCode: 1,
    },
    tasks,
  };
}

function finding(file: string, hunks?: FormatFinding['hunks']): FormatFinding {
  return { tool: 'oxfmt', directory: '', path: file, file, hunks };
}

function located(at: number): ToolAnnotation {
  return {
    level: 'error',
    message: `Type 'string' is not assignable to type 'number'. ${at}`,
    properties: { file: 'src/core.ts', line: at, col: 1, title: 'TS2322' },
  };
}

const firstHunk = '::error file=a.ts,line=4,title=oxfmt::';

describe('formatting findings', () => {
  it('reads the file list between oxfmt banner and verdict', () => {
    assert.deepEqual(parseOxfmtFiles(oxfmtOne), ['src/start-xvfb.core.ts']);
    assert.equal(parseOxfmtFiles(oxfmtMany).length, 4);
    assert.deepEqual(parseOxfmtFiles(oxfmtGreen), []);
    assert.deepEqual(
      parseOxfmtFiles(
        `${ESC}[1mChecking formatting...${ESC}[0m\r\nsrc/a.ts (1.2s)\r\nFormat issues found in above 1 files.`,
      ),
      ['src/a.ts'],
    );
  });

  it('reads taplo error lines and nothing else', () => {
    assert.deepEqual(parseTaploFiles(taploLog), [
      '/repo/tools/build_and_test/mise.toml',
    ]);
  });

  it('extracts repo-relative files from failed tasks only', () => {
    const run = summary([
      task({}),
      task({ taskId: '//#format:check:root', directory: '', package: '//' }),
      task({ taskId: '//#format:check:toml', directory: '', package: '//' }),
      task({
        taskId: '@tools/shared#format:check:oxfmt',
        directory: 'tools/shared',
        execution: { startTime: 0, endTime: 1, exitCode: 0 },
      }),
    ]);

    const logs = new Map([
      ['@tools/build_and_test#format:check:oxfmt', oxfmtOne],
      [
        '//#format:check:root',
        oxfmtOne.replace('src/start-xvfb.core.ts', 'README.md'),
      ],
      ['//#format:check:toml', taploLog],
      ['@tools/shared#format:check:oxfmt', oxfmtOne],
    ]);

    assert.deepEqual(
      extractFormatFindings(run, logs, '/repo').map(({ tool, file, path }) => [
        tool,
        file,
        path,
      ]),
      [
        [
          'oxfmt',
          'tools/build_and_test/src/start-xvfb.core.ts',
          'src/start-xvfb.core.ts',
        ],
        ['oxfmt', 'README.md', 'README.md'],
        [
          'taplo',
          'tools/build_and_test/mise.toml',
          '/repo/tools/build_and_test/mise.toml',
        ],
      ],
    );
  });

  it('reads old-side ranges from a -U0 diff', () => {
    assert.deepEqual(parseHunks(xvfbDiff), [
      { line: 4, endLine: 4 },
      { line: 11, endLine: 11 },
    ]);
    assert.deepEqual(
      parseHunks('@@ -10,3 +10,2 @@\n@@ -20,0 +21,2 @@\n@@ -0,0 +1 @@'),
      [
        { line: 10, endLine: 12 },
        { line: 20, endLine: 20 },
        { line: 1, endLine: 1 },
      ],
    );
  });

  it('annotates a file once, on its first hunk, with the count and the fix', () => {
    const one = formatAnnotation({
      ...finding('tools/build_and_test/src/start-xvfb.core.ts'),
      hunks: parseHunks(xvfbDiff),
    });

    assert.deepEqual(
      planAnnotations([], {}, [formattingTier([])]).commands,
      [],
    );
    assert.deepEqual(
      planAnnotations([], {}, [
        {
          annotations: [
            one,
            formatAnnotation(finding('b.ts', [{ line: 2, endLine: 5 }])),
            formatAnnotation(finding('c.toml')),
          ],
          limit: FORMAT_FILE_LIMIT,
          collapsed: { level: 'error', message: 'unused' },
        },
      ]).commands,
      [
        '::error file=tools/build_and_test/src/start-xvfb.core.ts,line=4,title=oxfmt::2 hunks need formatting; run pnpm format',
        '::error file=b.ts,line=2,endLine=5,title=oxfmt::1 hunk needs formatting; run pnpm format',
        '::error file=c.toml,title=oxfmt::needs formatting; run pnpm format',
      ],
    );
  });
});

describe('annotation budget', () => {
  const one = [finding('a.ts', [{ line: 4, endLine: 4 }])];

  it('gives located findings their slots before formatting', () => {
    const plan = planAnnotations([located(1), located(2)], { error: 1 }, [
      formattingTier(one),
    ]);

    assert.equal(plan.commands.length, 3);
    assert.match(plan.commands[0] ?? '', /title=TS2322/);
    assert.ok(plan.commands[2]?.startsWith(firstHunk));
    assert.deepEqual(plan.collapsed, [false]);
    assert.equal(plan.found.error, 2);
  });

  it('drops formatting to its one line when located findings leave too few slots', () => {
    const locatedErrors = Array.from(
      { length: ANNOTATION_LIMIT - 2 },
      (_, at) => located(at + 1),
    );

    const three = [...one, finding('b.ts'), finding('c.ts')];

    const plan = planAnnotations(locatedErrors, { error: 1 }, [
      formattingTier(three),
    ]);

    assert.equal(plan.commands.length, ANNOTATION_LIMIT - 1);
    assert.equal(
      plan.commands.at(-1),
      '::error title=formatting::3 files need `pnpm format`',
    );
    assert.deepEqual(plan.collapsed, [true]);
  });

  it('emits nothing for formatting when no slot is left, and keeps every located one', () => {
    const full = Array.from({ length: ANNOTATION_LIMIT }, (_, at) =>
      located(at + 1),
    );

    const plan = planAnnotations(full, { error: 1 }, [formattingTier(one)]);

    assert.equal(plan.commands.length, ANNOTATION_LIMIT - 1);
    assert.ok(plan.commands.every((command) => command.includes('TS2322')));
    assert.deepEqual(plan.collapsed, [true]);
  });

  it(`collapses past ${FORMAT_FILE_LIMIT} files even with slots to spare`, () => {
    const many = ['a', 'b', 'c', 'd'].map((name) => finding(`${name}.ts`));

    assert.deepEqual(
      planAnnotations([], { error: 1 }, [formattingTier(many)]).commands,
      ['::error title=formatting::4 files need `pnpm format`'],
    );
    assert.equal(
      planAnnotations([], {}, [formattingTier(many.slice(0, 3))]).commands
        .length,
      3,
    );
  });

  it('does not count formatting toward the re-emitted tool annotations', () => {
    const plan = planAnnotations([], {}, [formattingTier(one)]);

    assert.deepEqual(plan.found, { error: 0, warning: 0, notice: 0 });
  });
});

describe('formatting detail', () => {
  const findings = [
    finding(
      'tools/build_and_test/src/start-xvfb.core.ts',
      parseHunks(xvfbDiff),
    ),
    {
      ...finding('tools/build_and_test/mise.toml', [{ line: 51, endLine: 59 }]),
      tool: 'taplo' as const,
    },
    finding('README.md'),
    finding(
      'big.ts',
      Array.from({ length: 22 }, (_, at) => ({
        line: at + 1,
        endLine: at + 1,
      })),
    ),
  ];

  it('lists every file and hunk in a collapsed step-summary section', () => {
    const markdown = formattingMarkdown(findings);

    assert.ok(
      markdown.startsWith(
        '<details><summary>Formatting — 4 files need <code>pnpm format</code></summary>\n',
      ),
    );
    assert.match(
      markdown,
      /^- `tools\/build_and_test\/src\/start-xvfb\.core\.ts` \(oxfmt\) — lines 4, 11$/m,
    );
    assert.match(
      markdown,
      /^- `tools\/build_and_test\/mise\.toml` \(taplo\) — lines 51–59$/m,
    );
    assert.match(markdown, /^- `README\.md` \(oxfmt\) — lines unknown$/m);
    assert.match(markdown, /— lines 1, 2, .*, 20, … 2 more$/m);
    assert.match(markdown, /<\/details>\n\n$/);
    assert.equal(formattingMarkdown([]), '');
  });

  it('prints the same list on stdout', () => {
    assert.deepEqual(formattingLines(findings.slice(0, 1)), [
      '── formatting: 1 file needs `pnpm format`',
      '   tools/build_and_test/src/start-xvfb.core.ts (oxfmt): lines 4, 11',
      '',
    ]);
    assert.deepEqual(formattingLines([]), []);
  });
});
