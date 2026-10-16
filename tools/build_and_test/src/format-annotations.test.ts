import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  type FormatFinding,
  FORMAT_FILE_LIMIT,
  PREVIEW_FILE_LIMIT,
  PREVIEW_WIDTH,
  extractFormatFindings,
  formatAnnotation,
  formatPatch,
  formattingLines,
  formattingMarkdown,
  formattingTier,
  parseHunks,
  parseOxfmtFiles,
  parsePreview,
  parseTaploFiles,
  patchCommand,
  patchSection,
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

// A -U0 hunk that respaces three lines into two, with git's function context.
const multiDiff = [
  'diff --git a/a.ts b/tmp/0',
  '--- a/a.ts',
  '+++ b/tmp/0',
  '@@ -10,3 +10,2 @@ function main() {',
  '-  let   a=1;',
  '-  let   b=2;',
  '-  let   c=3;',
  '+  let a = 1;',
  '+  let b = 2;',
  '@@ -20 +19 @@',
  '-x',
  '+y',
].join('\n');

describe('diff preview', () => {
  it('keeps the first hunk, one changed line a side', () => {
    assert.deepEqual(parsePreview(xvfbDiff), {
      header: '@@ -4 +4 @@',
      removed: ['-      /^> Warning:\\s+Could not resolve keysym /;'],
      added: ['+  /^> Warning:\\s+Could not resolve keysym /;'],
      more: 0,
    });
    assert.deepEqual(parsePreview(multiDiff), {
      header: '@@ -10,3 +10,2 @@',
      removed: ['-  let   a=1;'],
      added: ['+  let a = 1;'],
      more: 2,
    });
  });

  it('counts source lines left out by the longer side, not diff lines', () => {
    const even =
      '@@ -9,3 +9,3 @@\n-a  =1\n-b  =2\n-c  =3\n+a = 1\n+b = 2\n+c = 3';

    const split = '@@ -5 +5,3 @@\n-f(a,b)\n+f(\n+  a,\n+  b)';

    assert.equal(parsePreview(even)?.more, 2);
    assert.equal(parsePreview(split)?.more, 2);
    assert.equal(parsePreview('@@ -1,2 +1 @@\n-a\n-b\n+ab')?.more, 1);
  });

  it('handles one-sided hunks, long lines and no hunk at all', () => {
    assert.deepEqual(parsePreview('@@ -3,0 +4,2 @@\n+a\n+b'), {
      header: '@@ -3,0 +4,2 @@',
      removed: [],
      added: ['+a'],
      more: 1,
    });
    const long = `-${'x'.repeat(PREVIEW_WIDTH + 40)}`;

    assert.equal(
      parsePreview(`@@ -1 +0,0 @@\n${long}`)?.removed[0],
      `${long.slice(0, PREVIEW_WIDTH)}…`,
    );
    assert.equal(parsePreview(''), undefined);
  });
});

describe('format patch', () => {
  it('readdresses the temp-path diff to the repo file and drops mode lines', () => {
    const section = patchSection(
      [
        'diff --git a/bin/run.ts b/tmp/format-diff-x/0',
        'old mode 100755',
        'new mode 100644',
        'index 1111111..2222222',
        '--- a/bin/run.ts',
        '+++ b/tmp/format-diff-x/0',
        '@@ -1,3 +1,3 @@',
        ' #!/usr/bin/env node',
        '-let   a=1;',
        '+let a = 1;',
        ' export {};',
        '',
      ].join('\n'),
      'bin/run.ts',
    );

    assert.equal(
      section,
      [
        'diff --git a/bin/run.ts b/bin/run.ts',
        '--- a/bin/run.ts',
        '+++ b/bin/run.ts',
        '@@ -1,3 +1,3 @@',
        ' #!/usr/bin/env node',
        '-let   a=1;',
        '+let a = 1;',
        ' export {};',
        '',
      ].join('\n'),
    );
    assert.equal(patchSection('', 'a.ts'), undefined);
    assert.equal(
      formatPatch([
        { ...finding('a.ts'), patch: 'A\n' },
        finding('b.ts'),
        { ...finding('c.ts'), patch: 'C\n' },
      ]),
      'A\nC\n',
    );
  });

  it('applies to the committed file and yields the formatted one', () => {
    const repo = mkdtempSync(join(tmpdir(), 'format-patch-'));

    const git = (...args: string[]) =>
      spawnSync('git', args, { cwd: repo, encoding: 'utf8' });

    try {
      const before =
        '#!/usr/bin/env node\nlet   a=1;\nlet b = 2;\nlet   c=3;\n';

      const after = '#!/usr/bin/env node\nlet a = 1;\nlet b = 2;\nlet c = 3;\n';

      writeFileSync(join(repo, 'run.ts'), before);
      chmodSync(join(repo, 'run.ts'), 0o755);
      writeFileSync(join(repo, 'formatted'), after);
      assert.equal(git('init', '-q').status, 0);

      const diff = git(
        'diff',
        '--no-index',
        '--no-color',
        '-U3',
        '--',
        'run.ts',
        'formatted',
      );

      assert.equal(diff.status, 1);
      const section = patchSection(diff.stdout, 'run.ts');

      assert.ok(section);
      writeFileSync(join(repo, 'format.patch'), section);
      const check = git('apply', '--check', 'format.patch');

      assert.equal(check.status, 0, check.stderr);
      assert.equal(git('apply', 'format.patch').status, 0);
      assert.equal(readFileSync(join(repo, 'run.ts'), 'utf8'), after);
      assert.equal(statSync(join(repo, 'run.ts')).mode & 0o777, 0o755);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('downloads from the run on Actions and reads the local file otherwise', () => {
    assert.equal(
      patchCommand('123'),
      'gh run download 123 -n format-patch && git apply format.patch',
    );
    assert.equal(patchCommand(undefined), 'git apply .turbo/format.patch');
  });
});

describe('formatting previews', () => {
  const previewed = (file: string): FormatFinding => ({
    ...finding(file, parseHunks(multiDiff)),
    preview: parsePreview(multiDiff),
  });

  it(`previews the first ${PREVIEW_FILE_LIMIT} diffed files under their entries`, () => {
    const files = Array.from({ length: PREVIEW_FILE_LIMIT + 2 }, (_, at) =>
      previewed(`f${at}.ts`),
    );

    const markdown = formattingMarkdown([finding('README.md'), ...files]);

    assert.equal(markdown.match(/^ {2}```diff$/gm)?.length, PREVIEW_FILE_LIMIT);
    assert.ok(
      markdown.includes(
        [
          '- `f0.ts` (oxfmt) — lines 10–12, 20',
          '',
          '  ```diff',
          '  @@ -10,3 +10,2 @@',
          '  -  let   a=1;',
          '  +  let a = 1;',
          '  … 2 more changed lines',
          '  ```',
          '',
          '- `f1.ts`',
        ].join('\n'),
      ),
    );
    assert.match(
      markdown,
      /^- `f6\.ts` \(oxfmt\) — lines 10–12, 20\n\n<\/details>/m,
    );
    assert.match(
      formattingMarkdown([
        {
          ...finding('a.ts', [{ line: 1, endLine: 2 }]),
          preview: parsePreview('@@ -1,2 +1 @@\n-a\n-b\n+ab'),
        },
      ]),
      /^ {2}… 1 more changed line$/m,
    );
  });

  it('fences past the longest backtick run in the diff', () => {
    const fenced = formattingMarkdown([
      {
        ...finding('README.md', [{ line: 1, endLine: 1 }]),
        preview: parsePreview('@@ -1 +1 @@\n-```ts\n+````ts'),
      },
    ]);

    assert.ok(
      fenced.includes(
        '\n  `````diff\n  @@ -1 +1 @@\n  -```ts\n  +````ts\n  `````\n',
      ),
    );
  });

  it('prints the apply command, and what the patch leaves out', () => {
    const findings = [previewed('a.ts'), finding('b.ts')];
    const all = { command: 'git apply .turbo/format.patch', files: 2 };
    const some = { ...all, files: 1 };

    assert.match(
      formattingMarkdown(findings, all),
      /<\/details>\n\nApply the fix: `git apply \.turbo\/format\.patch`\n\n$/,
    );
    assert.doesNotMatch(formattingMarkdown(findings, all), /covers/);
    assert.match(
      formattingMarkdown(findings, some),
      /^The patch covers 1 of 2 files; run `pnpm format` for the rest\.$/m,
    );
    assert.deepEqual(formattingLines(findings, some), [
      '── formatting: 2 files need `pnpm format`',
      '   a.ts (oxfmt): lines 10–12, 20',
      '   b.ts (oxfmt): lines unknown',
      '   Apply the fix: `git apply .turbo/format.patch`',
      '   The patch covers 1 of 2 files; run `pnpm format` for the rest.',
      '',
    ]);
  });

  it('links the uploaded patch in the summary, not on stdout', () => {
    const url =
      'https://github.com/simshanith/lit-ui-router/actions/runs/1/artifacts/2';

    const patch = {
      command: 'gh run download 1 -n format-patch && git apply format.patch',
      files: 1,
      url,
    };

    assert.match(
      formattingMarkdown([previewed('a.ts')], patch),
      /^Apply the fix: \[format-patch\]\(<https:\/\/github\.com\/simshanith\/lit-ui-router\/actions\/runs\/1\/artifacts\/2>\) — `gh run download 1 -n format-patch && git apply format\.patch`$/m,
    );
    assert.ok(
      formattingLines([previewed('a.ts')], patch).includes(
        '   Apply the fix: `gh run download 1 -n format-patch && git apply format.patch`',
      ),
    );
    assert.match(
      formattingMarkdown([previewed('a.ts')], {
        ...patch,
        url: 'javascript:alert(1)',
      }),
      /^Apply the fix: `gh run download/m,
    );
  });
});
