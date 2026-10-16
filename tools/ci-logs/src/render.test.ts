import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanLog, countLines, render, type RunSource } from './render.ts';
import { RUN_GROUP, taskKey, type Task } from './summary.ts';

const info = (databaseId: number) => ({
  databaseId,
  workflowName: 'Build and Test',
  displayTitle: 'fix: something',
  event: 'push',
  headBranch: 'main',
  headSha: 'abc123',
  conclusion: 'success',
  url: `https://example.test/runs/${databaseId}`,
});

const source = (
  databaseId: number,
  tasks: (Task & { log?: string })[],
  artifacts: Partial<Pick<RunSource, 'downloaded' | 'expired'>> = {},
): RunSource => {
  const logs = new Map(
    tasks.flatMap(({ group, logFile, log }) =>
      log === undefined ? [] : [[`${group} ${logFile}`, log] as const],
    ),
  );

  return {
    info: info(databaseId),
    tasks: new Map(
      tasks.map((task) => [taskKey(task.group, task.taskId), task]),
    ),
    downloaded: artifacts.downloaded ?? [
      'turbo-task-logs',
      'turbo-run-summaries',
      'turbo-task-logs-docs',
      'turbo-run-summaries-docs',
    ],
    expired: artifacts.expired ?? [],
    readLog: (group, logFile) => logs.get(`${group} ${logFile}`),
  };
};

const task = (
  group: string,
  taskId: string,
  executed: boolean,
  log?: string,
): Task & { log?: string } => {
  const [pkg, name = ''] = taskId.split('#');

  return {
    group,
    taskId,
    logFile: `${pkg}/.turbo/turbo-${name.replaceAll(':', '$colon$')}.log`,
    executed,
    log,
  };
};

test('strips ANSI codes and CRLF, keeps the text', () => {
  assert.equal(
    cleanLog(
      '\u001B[32m✓\u001B[39m passed\r\n\u001B]8;;https://x\u0007link\u001B]8;;\u0007\n\n',
    ),
    '✓ passed\nlink',
  );
});

test('counts lines with or without a final newline', () => {
  assert.equal(countLines(''), 0);
  assert.equal(countLines('a\nb'), 2);
  assert.equal(countLines('a\nb\n'), 2);
});

test('executed logs come in full under their group and task id; replays by name', () => {
  const report = render(
    source(1, [
      task(
        RUN_GROUP,
        'pkg#test',
        true,
        '\u001B[1mRUN\u001B[22m pkg\n 3 passed\n',
      ),
      task('docs', 'pkg#build', false, 'replayed output\n'),
    ]),
  );

  assert.match(report, /^## run pkg#test\nRUN pkg\n 3 passed\n/m);
  assert.match(report, /^# REPLAYED \(1\)\n\ndocs pkg#build$/m);
  assert.doesNotMatch(report, /replayed output/);
  assert.ok(!report.includes('\u001B'));
});

test('replayed: inlines replay logs after the executed ones, headed as replays', () => {
  const report = render(
    source(1, [
      task(RUN_GROUP, 'pkg#test', true, 'executed output\n'),
      task('docs', 'pkg#build', false, '\u001B[33mwarn\u001B[39m cached\n'),
      task(RUN_GROUP, 'pkg#lint', false),
    ]),
    undefined,
    { replayed: true },
  );

  assert.match(
    report,
    /^## run pkg#test\nexecuted output\n\n# REPLAYED \(2\)\n\n## run pkg#lint \(replayed; describes the run that filled the cache\)\n\(pkg\/\.turbo\/turbo-lint\.log absent from turbo-task-logs\)\n\n## docs pkg#build \(replayed; describes the run that filled the cache\)\nwarn cached$/m,
  );
  assert.match(report, /^task logs missing: 1$/m);
  assert.match(report, new RegExp(`^lines out: ${countLines(report)}$`, 'm'));
});

test('replayed: baseline logs pair with executed tasks only', () => {
  const report = render(
    source(1, [
      task(RUN_GROUP, 'a#test', true, 'a now'),
      task(RUN_GROUP, 'b#test', false, 'b cached'),
    ]),
    source(2, [
      task(RUN_GROUP, 'a#test', true, 'a before'),
      task(RUN_GROUP, 'b#test', true, 'b before'),
    ]),
    { replayed: true },
  );

  assert.match(report, /^### baseline run 2 run a#test \(executed there\)$/m);
  assert.match(report, /\nb cached\n/);
  assert.doesNotMatch(report, /b before/);
  assert.match(report, /^baseline log lines in: 1$/m);
});

test('pairs each executed log with the baseline run’s', () => {
  const report = render(
    source(1, [
      task(RUN_GROUP, 'a#test', true, 'a now'),
      task(RUN_GROUP, 'b#test', true, 'b now'),
      task(RUN_GROUP, 'c#test', true, 'c now'),
    ]),
    source(2, [
      task(RUN_GROUP, 'a#test', true, 'a before'),
      task(RUN_GROUP, 'b#test', false, 'b cached'),
    ]),
  );

  assert.match(
    report,
    /^## run a#test\na now\n\n### baseline run 2 run a#test \(executed there\)\na before$/m,
  );
  assert.match(
    report,
    /^### baseline run 2 run b#test \(replayed there; describes the run that filled the cache\)\nb cached$/m,
  );
  assert.match(
    report,
    /^## run c#test\nc now\n\n### baseline run 2: absent from its run summaries$/m,
  );
});

test('says why a log is missing', () => {
  const report = render(
    source(
      1,
      [
        task(RUN_GROUP, 'a#test', true),
        task('docs', 'b#build', true, 'docs log'),
      ],
      {
        downloaded: ['turbo-run-summaries', 'turbo-run-summaries-docs'],
        expired: ['turbo-task-logs'],
      },
    ),
  );

  assert.match(report, /^## run a#test\n\(turbo-task-logs expired\)$/m);
  assert.match(
    report,
    /^## docs b#build\n\(no turbo-task-logs-docs artifact\)$/m,
  );
  assert.match(report, /expired: turbo-task-logs$/m);
});

test('names a log the summary lists but the artifact lacks', () => {
  const report = render(
    source(1, [
      task(RUN_GROUP, 'a#test', true),
      task(RUN_GROUP, 'b#lint', false),
    ]),
  );

  assert.match(
    report,
    /^\(a\/\.turbo\/turbo-test\.log absent from turbo-task-logs\)$/m,
  );
  assert.match(
    report,
    /^run b#lint \(b\/\.turbo\/turbo-lint\.log absent from turbo-task-logs\)$/m,
  );
  assert.match(report, /^task logs missing: 2$/m);
});

test('flags a run with no summaries', () => {
  assert.match(render(source(1, [])), /^\(no run summaries: /m);
});

test('counts match the report', () => {
  const report = render(
    source(1, [
      task(RUN_GROUP, 'a#test', true, 'one\ntwo\n'),
      task(RUN_GROUP, 'b#test', false, 'three\n'),
    ]),
    source(2, [task(RUN_GROUP, 'a#test', true, 'x\ny\nz\n')]),
  );

  assert.match(
    report,
    /^executed: 1\nreplayed: 1\ntask logs missing: 0\nlog lines in: 3\nbaseline log lines in: 3$/m,
  );
  assert.match(report, new RegExp(`^lines out: ${countLines(report)}$`, 'm'));
});
