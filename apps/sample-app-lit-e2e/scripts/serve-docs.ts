import { spawn, type ChildProcess } from 'node:child_process';

// wrangler dev intermittently crashes mid-suite on CI runners (miniflare
// ProxyWorker "Network connection lost", workers-sdk#4561 class); respawning
// keeps start-server-and-test alive so the suite rerun in
// run-cypress-suites.ts finds a live server instead of failing the job.
const MAX_RESPAWNS = 2;

const args = ['--filter', 'docs', 'exec', 'wrangler', 'dev', '--port', '8787'];

let child: ChildProcess;
let respawns = 0;
let shuttingDown = false;

function start(): void {
  // detached makes the child a process-group leader so shutdown can kill the
  // whole pnpm → wrangler → workerd tree, not just pnpm.
  child = spawn('pnpm', args, { stdio: 'inherit', detached: true });
  child.on('exit', (code, signal) => {
    if (shuttingDown) process.exit(0);
    if (respawns >= MAX_RESPAWNS) {
      console.error(
        `[serve-docs] wrangler dev exited (${signal ?? `code ${code}`}); respawn budget exhausted`,
      );
      process.exit(code ?? 1);
    }
    respawns += 1;
    console.error(
      `[serve-docs] wrangler dev exited (${signal ?? `code ${code}`}); respawning (${respawns}/${MAX_RESPAWNS})`,
    );
    setTimeout(() => {
      if (shuttingDown) process.exit(0);
      start();
    }, 1000);
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  // start-server-and-test tree-kills this process when the suites finish;
  // only then does a child exit stop being a crash to respawn.
  process.on(signal, () => {
    shuttingDown = true;
    try {
      if (child.pid === undefined) process.exit(0);
      process.kill(-child.pid, signal);
    } catch {
      process.exit(0);
    }
  });
}

start();
