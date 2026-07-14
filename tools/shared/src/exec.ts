// The injectable child-process seam: tools take an `Exec`/`Stream` so unit
// tests assert the exact argv arrays without spawning anything, and every
// runtime invocation goes through execFile/spawn with an argv array — no
// shell ever re-parses user- or ref-controlled strings.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

export type ExecOptions = { cwd?: string };
export type ExecResult = { stdout: string; stderr: string };

/** Captured-output run for commands whose stdout the caller consumes. */
export type Exec = (
  command: string,
  args: readonly string[],
  options?: ExecOptions,
) => Promise<ExecResult>;

/**
 * Streamed run for long, mutating commands (release-it, git push): output
 * flows straight to the step log so collapsed steps stay readable live.
 */
export type Stream = (
  command: string,
  args: readonly string[],
  options?: ExecOptions,
) => Promise<void>;

const run = promisify(execFile);

export const defaultExec: Exec = async (command, args, options) => {
  const { stdout, stderr } = await run(command, [...args], {
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
  return { stdout, stderr };
};

export const defaultStream: Stream = (command, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], { stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `${command} ${args.join(' ')} exited with ${
              code === null ? `signal ${signal ?? 'unknown'}` : `code ${code}`
            }`,
          ),
        );
      }
    });
  });
