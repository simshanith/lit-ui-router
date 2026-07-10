import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { filterStderr, formatFilteredCount } from './start-xvfb.core.mjs';

const KEYSYM_NOISE = [
  '> Warning:          Could not resolve keysym XF86CameraAccessEnable',
  '> Warning:          Could not resolve keysym XF86CameraAccessDisable',
  '> Warning:          Could not resolve keysym XF86CameraAccessToggle',
];
const REAL_LINES = [
  'The XKEYBOARD keymap compiler (xkbcomp) reports:',
  'Errors from xkbcomp are not fatal to the X server',
  '(EE) Fatal server error: Cannot establish any listening sockets',
];
const SAMPLE_LINES = [
  REAL_LINES[0],
  ...KEYSYM_NOISE,
  REAL_LINES[1],
  REAL_LINES[2],
  '',
];

async function* asAsyncLines(lines) {
  yield* lines;
}

// Collects a filterStderr generator's yields and its trailing return value
// (which for-await would discard).
async function drain(generator) {
  const kept = [];
  let next;
  while (!(next = await generator.next()).done) kept.push(next.value);
  return { kept, filtered: next.value };
}

describe('filterStderr', () => {
  it('drops only exact keysym warnings and counts them', async () => {
    const { kept, filtered } = await drain(filterStderr(SAMPLE_LINES));
    assert.deepEqual(kept, REAL_LINES);
    assert.equal(filtered, 3);
  });

  it('accepts async iterables of lines', async () => {
    const { kept, filtered } = await drain(
      filterStderr(asAsyncLines(SAMPLE_LINES)),
    );
    assert.deepEqual(kept, REAL_LINES);
    assert.equal(filtered, 3);
  });

  it('keeps other xkbcomp warnings', async () => {
    const { kept, filtered } = await drain(
      filterStderr(['> Warning:          Type "ONE_LEVEL" has 1 levels']),
    );
    assert.deepEqual(kept, [
      '> Warning:          Type "ONE_LEVEL" has 1 levels',
    ]);
    assert.equal(filtered, 0);
  });
});

describe('formatFilteredCount', () => {
  it('reports the filtered count', () => {
    assert.equal(
      formatFilteredCount(3),
      "(filtered 3 'Could not resolve keysym' warnings)",
    );
  });
});

const scriptPath = fileURLToPath(new URL('./start-xvfb.mjs', import.meta.url));

function writeFakeXvfb(dir, body) {
  const bin = path.join(dir, 'fake-xvfb.mjs');
  fs.writeFileSync(bin, `#!/usr/bin/env node\n${body}`, { mode: 0o755 });
  return bin;
}

function runStartXvfb(env) {
  return spawnSync(process.execPath, [scriptPath], {
    encoding: 'utf8',
    env: { ...process.env, XVFB_TIMEOUT_MS: '3000', ...env },
  });
}

describe('start-xvfb.mjs', () => {
  it('fails with filtered stderr when Xvfb dies', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xvfb-test-'));
    const bin = writeFakeXvfb(
      dir,
      [...KEYSYM_NOISE, ...REAL_LINES]
        .map((line) => `console.error(${JSON.stringify(line)});`)
        .join('\n') + '\nprocess.exit(1);\n',
    );
    const run = runStartXvfb({
      XVFB_BIN: bin,
      XVFB_SOCKET: path.join(dir, 'no-such-socket'),
    });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /Xvfb failed to start:/);
    assert.match(run.stderr, /Fatal server error/);
    assert.match(
      run.stderr,
      /\(filtered 3 'Could not resolve keysym' warnings\)/,
    );
    assert.doesNotMatch(run.stderr, /XF86CameraAccess/);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('exports DISPLAY and stays quiet when the display comes up', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xvfb-test-'));
    const socket = path.join(dir, 'socket');
    const githubEnv = path.join(dir, 'github.env');
    fs.writeFileSync(githubEnv, '');
    const bin = writeFakeXvfb(
      dir,
      [
        "import fs from 'node:fs';",
        ...KEYSYM_NOISE.map(
          (line) => `console.error(${JSON.stringify(line)});`,
        ),
        `fs.writeFileSync(${JSON.stringify(socket)}, '');`,
        'setTimeout(() => {}, 3000);',
      ].join('\n') + '\n',
    );
    const run = runStartXvfb({
      XVFB_BIN: bin,
      XVFB_SOCKET: socket,
      GITHUB_ENV: githubEnv,
    });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /Xvfb ready on :99/);
    assert.doesNotMatch(run.stderr, /keysym/);
    assert.equal(fs.readFileSync(githubEnv, 'utf8'), 'DISPLAY=:99\n');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
