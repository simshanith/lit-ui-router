#!/usr/bin/env node
// Starts the shared CI Xvfb display and exports DISPLAY via GITHUB_ENV.
//
// Xvfb's stderr is routine xkbcomp keysym noise on the runner image, so it
// goes to an unlinked temp file — a durable sink Xvfb can keep writing to
// after this process exits (a pipe would go EPIPE on later writes). The
// capture is read back, noise filtered with a count, only if the server
// fails to come up.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { formatFailure } from './start-xvfb.core.mjs';

const display = ':99';
const xvfbBin = process.env.XVFB_BIN ?? 'Xvfb';
const socketPath =
  process.env.XVFB_SOCKET ?? `/tmp/.X11-unix/X${display.slice(1)}`;
const timeoutMs = Number(process.env.XVFB_TIMEOUT_MS ?? 5000);

const stderrPath = path.join(os.tmpdir(), `xvfb-stderr-${process.pid}`);
const stderrFd = fs.openSync(stderrPath, 'w+');
fs.unlinkSync(stderrPath);

const xvfb = spawn(xvfbBin, [display, '-screen', '0', '1280x720x24'], {
  detached: true,
  stdio: ['ignore', 'ignore', stderrFd],
});
xvfb.unref();

let spawnError;
let exited = false;
xvfb.on('error', (error) => {
  spawnError = error;
});
xvfb.on('exit', () => {
  exited = true;
});

let ready = false;
const deadline = Date.now() + timeoutMs;
while (Date.now() < deadline) {
  if (spawnError || exited) break;
  if (fs.existsSync(socketPath)) {
    ready = true;
    break;
  }
  await delay(100);
}

if (!ready) {
  if (spawnError) console.error(String(spawnError));
  const size = fs.fstatSync(stderrFd).size;
  const captured = Buffer.alloc(size);
  if (size > 0) fs.readSync(stderrFd, captured, 0, size, 0);
  console.error(formatFailure(captured.toString('utf8')));
  process.exit(1);
}

fs.closeSync(stderrFd);
if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, `DISPLAY=${display}\n`);
}
console.log(`Xvfb ready on ${display}`);
