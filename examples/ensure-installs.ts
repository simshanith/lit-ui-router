#!/usr/bin/env node
// Idempotent per-example `npm ci`: a lock-hash stamp makes warm dirs a no-op,
// and an atomic mkdir lock serializes concurrent installers (typecheck and
// build:embeds both self-provision; a turbo edge may not serialize them, #267).
// --postinstall marks the local-convenience path: skipped in CI, where only
// tasks that actually execute pay for the install.
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = ['helloworld', 'hellosolarsystem', 'hellogalaxy'];
const STALE_LOCK_MS = 5 * 60_000;

const args = process.argv.slice(2);
const postinstall = args.includes('--postinstall');
const names = args.filter((a) => !a.startsWith('--'));

if (postinstall && process.env.CI) {
  console.log(
    '[ensure-installs] CI: deferred to the tasks that need example node_modules',
  );
  process.exit(0);
}
const invalid = names.filter((n) => !EXAMPLES.includes(n));
if (invalid.length > 0) {
  console.error(`[ensure-installs] unknown example(s): ${invalid.join(', ')}`);
  process.exit(1);
}

function run(cmd: string, cmdArgs: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, { cwd: root, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${cmdArgs.join(' ')} exited ${code}`));
    });
  });
}

async function ensure(name: string): Promise<void> {
  const want = createHash('sha256')
    .update(readFileSync(join(root, name, 'package-lock.json')))
    .digest('hex');
  const stampPath = join(root, name, 'node_modules', '.install-stamp');
  const fresh = () =>
    existsSync(stampPath) && readFileSync(stampPath, 'utf8') === want;
  if (fresh()) return;

  const lockDir = join(root, `.install-lock-${name}`);
  for (;;) {
    try {
      mkdirSync(lockDir);
      break;
    } catch {
      try {
        if (Date.now() - statSync(lockDir).mtimeMs > STALE_LOCK_MS)
          rmSync(lockDir, { recursive: true, force: true });
      } catch {
        // lock released between mkdir and stat; retry immediately
      }
      await sleep(500);
    }
  }
  try {
    if (fresh()) return; // the holder we waited on installed it
    await run('npm', ['run', `example:install:${name}`]);
    writeFileSync(stampPath, want);
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

await Promise.all((names.length > 0 ? names : EXAMPLES).map(ensure));
