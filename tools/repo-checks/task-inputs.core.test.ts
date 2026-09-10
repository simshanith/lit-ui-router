import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type AuditableTask,
  auditTaskInputs,
  formatFailure,
  formatOverhash,
  inputPath,
  narrowToGenerated,
  packageFiles,
  repoIgnored,
  unhashedFiles,
  untrackedInputs,
} from './task-inputs.core.ts';

const task = (over: Partial<AuditableTask> = {}): AuditableTask => ({
  taskId: 'pkg#test',
  directory: 'packages/pkg',
  command: 'vitest run',
  cache: true,
  inputs: {},
  ...over,
});

const tracked = [
  'packages/pkg/src/index.ts',
  'packages/pkg/vitest.setup.browser.ts',
  'packages/other/src/index.ts',
  'README.md',
];

describe('packageFiles', () => {
  it('rewrites tracked paths package-relative', () => {
    assert.deepEqual(packageFiles(tracked, 'packages/pkg'), [
      'src/index.ts',
      'vitest.setup.browser.ts',
    ]);
  });

  it('gives a root task the whole repo', () => {
    assert.deepEqual(packageFiles(tracked, ''), tracked);
  });
});

describe('unhashedFiles', () => {
  it('reports what the cache key misses', () => {
    assert.deepEqual(
      unhashedFiles(task({ inputs: { 'src/index.ts': 'abc' } }), tracked),
      ['vitest.setup.browser.ts'],
    );
  });

  it('passes when every tracked file is hashed', () => {
    const inputs = { 'src/index.ts': 'a', 'vitest.setup.browser.ts': 'b' };
    assert.deepEqual(unhashedFiles(task({ inputs }), tracked), []);
  });
});

describe('inputPath', () => {
  it('resolves the ../ turbo reports for a $TURBO_ROOT$ input', () => {
    assert.equal(
      inputPath('tools/repo-checks', '../../pnpm-workspace.yaml'),
      'pnpm-workspace.yaml',
    );
  });

  it('leaves a root task input alone', () => {
    assert.equal(inputPath('', 'README.md'), 'README.md');
  });
});

describe('untrackedInputs', () => {
  const trackedSet = new Set(tracked);

  it('reports generated files the key hashes', () => {
    const inputs = { 'src/index.ts': 'a', 'coverage/index.html': 'b' };
    assert.deepEqual(untrackedInputs(task({ inputs }), trackedSet), [
      'packages/pkg/coverage/index.html',
    ]);
  });

  it('resolves out-of-package inputs before judging them', () => {
    const inputs = {
      '../other/src/index.ts': 'a',
      '../other/dist/out.js': 'b',
    };
    assert.deepEqual(untrackedInputs(task({ inputs }), trackedSet), [
      'packages/other/dist/out.js',
    ]);
  });

  it('allows a named file and anything under a named directory', () => {
    const inputs = { 'coverage/index.html': 'a', '../../.husky/_/x.sh': 'b' };
    const allowed = [
      { path: 'packages/pkg/coverage/index.html', why: 'exact' },
      { path: '.husky/_', why: 'directory' },
    ];
    assert.deepEqual(
      untrackedInputs(task({ inputs }), trackedSet, allowed),
      [],
    );
  });

  it('does not let an allowance prefix-match a sibling path', () => {
    const inputs = { 'coverage-old/index.html': 'a' };
    const allowed = [{ path: 'packages/pkg/coverage', why: 'directory' }];
    assert.deepEqual(untrackedInputs(task({ inputs }), trackedSet, allowed), [
      'packages/pkg/coverage-old/index.html',
    ]);
  });
});

describe('auditTaskInputs', () => {
  const gap = task({ inputs: { 'src/index.ts': 'abc' } });

  it('fails a task with unhashed tracked files', () => {
    const audit = auditTaskInputs([gap], tracked, []);
    assert.deepEqual(audit.failures, [
      { taskId: 'pkg#test', missing: ['vitest.setup.browser.ts'] },
    ]);
    assert.equal(audit.audited, 1);
  });

  it('reports a task hashing generated output', () => {
    const hashesAll = Object.fromEntries(
      packageFiles(tracked, 'packages/pkg').map((file) => [file, 'h']),
    );
    const audit = auditTaskInputs(
      [task({ inputs: { ...hashesAll, 'dist/index.js': 'h' } })],
      tracked,
      [],
    );
    assert.deepEqual(audit.failures, []);
    assert.deepEqual(audit.overhashing, [
      { taskId: 'pkg#test', untracked: ['packages/pkg/dist/index.js'] },
    ]);
  });

  it('judges over-hashing on tasks the under-hash exemption covers', () => {
    const audit = auditTaskInputs([gap], tracked, [
      { task: 'test', why: 'because' },
    ]);
    assert.deepEqual(audit.failures, []);
    assert.deepEqual(audit.overhashing, []);
  });

  it('skips uncacheable tasks and scriptless graph nodes', () => {
    const audit = auditTaskInputs(
      [
        task({ taskId: 'pkg#dev', cache: false }),
        task({ taskId: 'pkg#transit', command: '<NONEXISTENT>' }),
      ],
      tracked,
      [],
    );
    assert.deepEqual(audit.failures, []);
    assert.equal(audit.audited, 0);
  });

  it('exempts by task name, across every package', () => {
    const audit = auditTaskInputs(
      [gap, task({ taskId: 'other#test', directory: 'packages/other' })],
      tracked,
      [{ task: 'test', why: 'because' }],
    );
    assert.deepEqual(audit.failures, []);
    assert.deepEqual(audit.stale, []);
  });

  it('reports an exemption no task needs any more', () => {
    const audit = auditTaskInputs([gap], tracked, [
      { task: 'test', why: 'because' },
      { task: 'lint:markdown', why: 'md only' },
    ]);
    assert.deepEqual(audit.stale, ['lint:markdown']);
  });

  it('sorts failures by task id', () => {
    const audit = auditTaskInputs(
      [
        task({ taskId: 'z-pkg#test' }),
        task({ taskId: 'a-pkg#test', directory: 'packages/other' }),
      ],
      tracked,
      [],
    );
    assert.deepEqual(
      audit.failures.map(({ taskId }) => taskId),
      ['a-pkg#test', 'z-pkg#test'],
    );
  });
});

describe('repoIgnored', () => {
  const tracked = new Set(['.gitignore', 'www/.gitignore']);

  it('keeps a verdict from a tracked ignore file', () => {
    assert.deepEqual(
      [
        ...repoIgnored(
          '.gitignore:8:node_modules\tpkg/node_modules/a.js\n' +
            'www/.gitignore:2:.temp\twww/.temp/b.js',
          tracked,
        ),
      ],
      ['pkg/node_modules/a.js', 'www/.temp/b.js'],
    );
  });

  it('drops a verdict only this machine would reach', () => {
    // a global core.excludesFile or info/exclude is absent in CI, so trusting
    // it would fail the lane locally and pass it there
    assert.deepEqual(
      [
        ...repoIgnored(
          '/home/dev/.gitignore:32:.idea\tpkg/.idea/workspace.xml\n' +
            '/repo/.git/info/exclude:4:scratch\tpkg/scratch.ts',
          tracked,
        ),
      ],
      [],
    );
  });

  it('ignores the empty trailing line', () => {
    assert.deepEqual([...repoIgnored('', tracked)], []);
  });
});

describe('narrowToGenerated', () => {
  const reports = [
    { taskId: 'pkg#lint', untracked: ['pkg/dist/a.js', 'pkg/scratch.ts'] },
    { taskId: 'other#lint', untracked: ['other/notes.ts'] },
  ];

  it('keeps only the ignored files', () => {
    assert.deepEqual(narrowToGenerated(reports, new Set(['pkg/dist/a.js'])), [
      { taskId: 'pkg#lint', untracked: ['pkg/dist/a.js'] },
    ]);
  });

  it('never fails a lane over an unstaged source file', () => {
    assert.deepEqual(narrowToGenerated(reports, new Set()), []);
  });
});

describe('formatOverhash', () => {
  it('names the task, the files and the fix', () => {
    assert.match(
      formatOverhash({ taskId: 'pkg#lint', untracked: ['pkg/dist/a.js'] }),
      /^pkg#lint hashes 1 untracked file\(s\).*pkg\/dist\/a\.js.*\$TURBO_DEFAULT\$/,
    );
  });

  it('truncates a long list', () => {
    const untracked = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    assert.match(formatOverhash({ taskId: 'pkg#lint', untracked }), /\+2 more/);
  });
});

describe('formatFailure', () => {
  it('names the task, the files and the fix', () => {
    assert.match(
      formatFailure({ taskId: 'pkg#test', missing: ['vitest.setup.ts'] }),
      /^pkg#test does not hash 1 tracked file\(s\).*vitest\.setup\.ts.*\$TURBO_DEFAULT\$/,
    );
  });

  it('truncates a long list', () => {
    const missing = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    assert.match(formatFailure({ taskId: 'pkg#test', missing }), /\+2 more/);
  });
});
