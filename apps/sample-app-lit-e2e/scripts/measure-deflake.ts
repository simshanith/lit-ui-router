#!/usr/bin/env node
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

// How often the wrangler-dev e2e crash (cloudflare/workers-sdk#14926) fires in
// CI: scans build-test runs — every attempt, since organic crashes get rerun
// and latest-attempt logs undercount — and reports crashes per e2e execution.
// Turbo cache-hit replays re-print old logs verbatim, so only "cache
// miss/bypass" executions count as exposures.
// Usage: mise run measure_deflake --days 7 [--branch mybranch] [--repo …]
// Every default lives in that task's #USAGE spec, so this script requires its
// full config: the [days] positional plus MEASURE_DEFLAKE_{REPO,WORKFLOW,
// MAX_LOG_MB,RUN_LIMIT}. Direct exec (./scripts/measure-deflake.ts 7 [branch])
// works only with those four exported.
// [branch] isolates one branch's runs — e.g. rate a wrangler-bump trial
// branch (forced dispatches against its ref) without main's runs diluting it.
const execFile = promisify(execFileCb);

function fail(what: string): never {
  console.error(
    `${what} — run via \`mise run measure_deflake\`, which supplies every default from its usage spec`,
  );
  process.exit(1);
}

function requiredEnv(name: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw === '') fail(`missing ${name}`);
  return raw;
}

function positiveEnv(name: string): number {
  const raw = requiredEnv(name);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) fail(`invalid ${name}: ${raw}`);
  return value;
}

const REPO = requiredEnv('MEASURE_DEFLAKE_REPO');
const WORKFLOW = requiredEnv('MEASURE_DEFLAKE_WORKFLOW');
// run logs are tens of MB; execFile's default 1MB maxBuffer would truncate
const MAX_LOG_BYTES = positiveEnv('MEASURE_DEFLAKE_MAX_LOG_MB') * 1024 ** 2;
// gh returns newest-first and caps silently, so a hit clips the window's old end
const RUN_LIMIT = positiveEnv('MEASURE_DEFLAKE_RUN_LIMIT');

async function gh(args: string[]): Promise<string> {
  const { stdout } = await execFile('gh', args, { maxBuffer: MAX_LOG_BYTES });
  return stdout;
}

const daysArg = process.argv[2];
if (daysArg === undefined) fail('missing [days] argument');
const days = Number(daysArg);
if (!Number.isFinite(days) || days <= 0)
  fail(`invalid days argument: ${daysArg}`);
const since = new Date(Date.now() - days * 86_400_000)
  .toISOString()
  .replace(/\.\d+Z$/, 'Z');
const branch = process.argv[3];

// completed only: an in-progress run has no fetchable log yet
const runs = JSON.parse(
  await gh([
    ...['run', 'list', '--repo', REPO, '--workflow', WORKFLOW],
    ...['--limit', String(RUN_LIMIT), '--created', `>=${since}`],
    ...['--status', 'completed'],
    ...(branch === undefined ? [] : ['--branch', branch]),
    ...['--json', 'databaseId,attempt'],
  ]),
) as { attempt: number; databaseId: number }[];

if (runs.length === RUN_LIMIT) {
  console.error(
    `run list hit the ${RUN_LIMIT}-run cap — the oldest runs in the ${days}-day window were dropped, so any rate below is over a clipped window; shorten --days or raise --run-limit`,
  );
  process.exitCode = 1;
}

let executed = 0;
let fired = 0;
// soft log-fetch failures would silently shrink the denominator
let unavailable = 0;
for (const { attempt: attempts, databaseId: id } of runs) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let log: string;
    try {
      log = await gh([
        'run',
        'view',
        '--repo',
        REPO,
        String(id),
        '--attempt',
        String(attempt),
        '--log',
      ]);
    } catch (error) {
      const { code, stderr } = error as {
        code?: string | number;
        stderr?: string;
      };
      if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        // a swallowed overflow would silently undercount both sides of the rate
        console.error(
          `${id} attempt ${attempt}: log exceeds the ${String(MAX_LOG_BYTES / 1024 ** 2)}MB cap — stats invalid, raise --max-log-mb`,
        );
        process.exitCode = 1;
        continue;
      }
      const reason =
        (stderr ?? '').trim().split('\n')[0] || `exit ${String(code)}`;
      console.error(`${id} attempt ${attempt}: log unavailable (${reason})`);
      unavailable += 1;
      process.exitCode = 1;
      continue;
    }
    if (!/sample-app-lit-e2e:test: cache (miss|bypass)/.test(log)) continue;
    executed += 1;
    const hits: string[] = [];
    // pre-deflake signature: the crash strands remaining specs on ECONNREFUSED
    if (log.includes('ECONNREFUSED 127.0.0.1:8787')) hits.push('crash');
    // post-deflake signatures: pm2 respawned wrangler / failed suites rerun
    if ((log.match(/App \[wrangler-dev:0\] online/g) ?? []).length > 1)
      hits.push('respawn');
    if (log.includes('[e2e] retrying')) hits.push('retry');
    if (hits.length > 0) fired += 1;
    console.log(`${id} attempt ${attempt}: ${hits.join('+') || 'clean'}`);
  }
}

const where = branch === undefined ? '' : ` on ${branch}`;
console.log('---');
if (executed === 0) {
  console.log(`no e2e executions found since ${since}${where}`);
} else {
  const pct = Math.round((100 * fired) / executed);
  console.log(
    `since ${since}${where}: e2e executed ${executed} times, crash fired ${fired} times (${pct}%)`,
  );
}
if (unavailable > 0)
  console.error(
    `${unavailable} attempt logs were unavailable — the rate above is over an incomplete sample`,
  );
