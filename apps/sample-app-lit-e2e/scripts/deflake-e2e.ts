import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { appendFileSync, createWriteStream, readFileSync } from 'node:fs';
import { connect } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

// Sample the sample-app-lit-e2e suites N times serially and report per-attempt
// flake. Inputs ride the environment (workflow step `env:`), never argv:
//   DEFLAKE_RUNS  attempts, clamped to 1-10 (non-numeric/empty -> 5)
//   DEFLAKE_PORT  dev-server port to verify free between attempts (default 8787)
// Attempts run OUTSIDE turbo so a cached test task can't replay attempt 1.

// The workers-sdk#14926 crash surfaces as the client failing to reach the dev
// server. Exported so measure-deflake.ts can count the same signature.
export const crashSignatureFor = (port: number): string =>
  `ECONNREFUSED 127.0.0.1:${port}`;

// Bounded wait for the port to drain after a sweep (seconds).
const PORT_WAIT_TRIES = 20;

export function clampRuns(raw: string | undefined): number {
  if (raw === undefined || !/^[0-9]+$/.test(raw)) return 5;
  return Math.min(10, Math.max(1, Number.parseInt(raw, 10)));
}

export function parsePort(raw: string | undefined): number {
  if (raw === undefined || !/^[0-9]+$/.test(raw)) return 8787;
  return Number.parseInt(raw, 10);
}

// True when something answers a TCP connect on 127.0.0.1:port. Connection
// refused = free; unlike the old `ss` parse this works on macOS too.
function portHeld(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

// pkill/pgrep exit non-zero on no match; that's not an error here.
function signal(cmd: 'pkill' | 'pgrep', args: string[]): boolean {
  try {
    execFileSync(cmd, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Kill any wrangler/workerd left over from a previous attempt, then wait for
// the port to actually drain. Returns false if the port is still held, so the
// caller can fail that attempt instead of running it against a zombie server
// (which would answer 200 and turn a poisoned attempt green).
//
// Selectors are load-bearing: bare `-f wrangler` catches the `wrangler.js dev`
// supervisor, `-x workerd` the runtime child. `pkill -f "wrangler dev"` misses
// the supervisor (its argv is the resolved wrangler.js path) — don't "fix" it.
async function sweep(phase: string, port: number): Promise<boolean> {
  signal('pkill', ['-f', 'wrangler']);
  signal('pkill', ['-x', 'workerd']);
  await sleep(1000);
  if (
    signal('pgrep', ['-f', 'wrangler']) ||
    signal('pgrep', ['-x', 'workerd'])
  ) {
    console.log(
      `[deflake] ${phase}: processes survived SIGTERM, escalating to SIGKILL`,
    );
    signal('pkill', ['-9', '-f', 'wrangler']);
    signal('pkill', ['-9', '-x', 'workerd']);
    await sleep(1000);
  }
  for (let i = 1; i <= PORT_WAIT_TRIES; i++) {
    if (!(await portHeld(port))) return true;
    await sleep(1000);
  }
  console.error(
    `[deflake] ${phase}: port :${port} still held after ${PORT_WAIT_TRIES}s`,
  );
  return false;
}

interface Attempt {
  attempt: number;
  result: 'pass' | 'FAIL';
  crash: string;
  note: string;
}

let inflight: ChildProcess | undefined;

async function runAttempt(logFile: string): Promise<number> {
  const log = createWriteStream(logFile);
  const child = spawn('pnpm', ['--filter', 'sample-app-lit-e2e', 'test'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  inflight = child;
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  const code = await new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (exitCode) => resolve(exitCode ?? 1));
  });
  inflight = undefined;
  await new Promise((resolve) => log.close(resolve));
  return code;
}

async function main(): Promise<void> {
  // The workflow's cancel-in-progress delivers SIGTERM/SIGINT; take the
  // in-flight test child down with us instead of orphaning a dev server.
  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, () => {
      inflight?.kill(sig);
      process.exit(1);
    });
  }

  const runs = clampRuns(process.env.DEFLAKE_RUNS);
  const port = parsePort(process.env.DEFLAKE_PORT);
  const crashSignature = crashSignatureFor(port);

  let fails = 0;
  let crashes = 0;
  const attempts: Attempt[] = [];

  for (let i = 1; i <= runs; i++) {
    const logFile = `attempt-${i}.log`;
    const row: Attempt = { attempt: i, result: 'pass', crash: '-', note: '-' };
    attempts.push(row);

    // Sweep BEFORE every attempt, the first included: the runner can carry a
    // stray listener in from the build step, and a crashed attempt orphans one.
    if (!(await sweep(`attempt ${i}/${runs}`, port))) {
      row.result = 'FAIL';
      row.note = `port :${port} held — attempt not run`;
      fails++;
      console.log(`[deflake] attempt ${i}/${runs}: FAIL (${row.note})`);
      continue;
    }

    console.log(`::group::[deflake] attempt ${i}/${runs}`);
    if ((await runAttempt(logFile)) !== 0) row.result = 'FAIL';
    const output = readFileSync(logFile, 'utf8');
    if (output.includes(crashSignature)) {
      row.crash = 'workers-sdk#14926 class';
      crashes++;
    }
    if (row.result === 'FAIL') {
      fails++;
      console.log(output.split('\n').slice(-60).join('\n'));
    } else if (row.crash !== '-') {
      row.note = 'near miss: passed with the crash signature';
    }
    console.log('::endgroup::');

    console.log(
      `[deflake] attempt ${i}/${runs}: ${row.result} (server crash: ${row.crash})`,
    );
  }

  const verdict = `${fails}/${runs} attempts failed; crash signature seen in ${crashes} attempts (including passing ones)`;

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      [
        `### Deflake e2e: ${runs} attempts`,
        '',
        '| attempt | result | crash signature | note |',
        '| --- | --- | --- | --- |',
        ...attempts.map(
          (a) => `| ${a.attempt} | ${a.result} | ${a.crash} | ${a.note} |`,
        ),
        '',
        `**${verdict}**`,
        '',
      ].join('\n'),
    );
  }

  console.log(`[deflake] ${verdict}`);
  process.exitCode = fails;
}

if (import.meta.main) await main();
