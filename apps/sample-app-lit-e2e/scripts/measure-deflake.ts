import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

// How often the wrangler-dev e2e crash (cloudflare/workers-sdk#14926) fires in
// CI: scans build-test runs — every attempt, since organic crashes get rerun
// and latest-attempt logs undercount — and reports crashes per e2e execution.
// Turbo cache-hit replays re-print old logs verbatim, so only "cache
// miss/bypass" executions count as exposures.
// Usage: node scripts/measure-deflake.ts [days=7]
const execFile = promisify(execFileCb);
const REPO = 'simshanith/lit-ui-router';
// run logs are tens of MB; execFile's default 1MB maxBuffer would truncate
const MAX_LOG_BYTES = 512 * 1024 * 1024;

async function gh(args: string[]): Promise<string> {
  const { stdout } = await execFile('gh', args, { maxBuffer: MAX_LOG_BYTES });
  return stdout;
}

const days = Number(process.argv[2] ?? 7);
if (!Number.isFinite(days) || days <= 0) {
  console.error(`invalid days argument: ${process.argv[2]}`);
  process.exit(1);
}
const since = new Date(Date.now() - days * 86_400_000)
  .toISOString()
  .replace(/\.\d+Z$/, 'Z');

const runs = JSON.parse(
  await gh([
    ...['run', 'list', '--repo', REPO, '--workflow', 'build-test.yml'],
    ...['--limit', '300', '--created', `>=${since}`],
    ...['--json', 'databaseId', '--jq', '[.[].databaseId]'],
  ]),
) as number[];

let executed = 0;
let fired = 0;
for (const id of runs) {
  const attempts = Number(
    await gh([
      'api',
      `repos/${REPO}/actions/runs/${id}`,
      '--jq',
      '.run_attempt',
    ]),
  );
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
          `${id} attempt ${attempt}: log exceeds MAX_LOG_BYTES — stats invalid, raise the cap`,
        );
        process.exitCode = 1;
        continue;
      }
      const reason =
        (stderr ?? '').trim().split('\n')[0] || `exit ${String(code)}`;
      console.error(`${id} attempt ${attempt}: log unavailable (${reason})`);
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

console.log('---');
if (executed === 0) {
  console.log(`no e2e executions found since ${since}`);
} else {
  const pct = Math.round((100 * fired) / executed);
  console.log(
    `since ${since}: e2e executed ${executed} times, crash fired ${fired} times (${pct}%)`,
  );
}
