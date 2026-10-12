// The injectable child-process seam: tools take an `Exec`/`Stream` so unit
// tests assert the exact argv arrays without spawning anything, and every
// runtime invocation goes through execFile/spawn with an argv array — no
// shell ever re-parses user- or ref-controlled strings.

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import * as v from 'valibot';

export type ExecOptions = { cwd?: string; env?: NodeJS.ProcessEnv };

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

/**
 * Captured run with no output ceiling, for commands whose stdout is a whole
 * machine-readable document rather than a line or two. `turbo run --dry-run=json`
 * over the CI lanes already emits 20 MB and grows with the graph, so a fixed
 * ceiling here is a break waiting on the next cache miss — reading off the pipe
 * removes the number instead of raising it. Rejects with the same
 * `stdout`/`stderr` properties execFile attaches, which callers read to tell an
 * expected failure from a real one.
 */
export const defaultCapture: Exec = (command, args, options) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options,
    });

    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      const result = {
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
      };

      if (code === 0) resolve(result);
      else {
        reject(
          Object.assign(
            new Error(
              `${command} ${args.join(' ')} exited with ${
                code === null ? `signal ${signal ?? 'unknown'}` : `code ${code}`
              }`,
            ),
            result,
          ),
        );
      }
    });
  });

const ExecFailureSchema = v.object({
  code: v.fallback(v.optional(v.number()), undefined),
  stdout: v.fallback(v.optional(v.string()), undefined),
  stderr: v.fallback(v.optional(v.string()), undefined),
});

/** The exit code and output a rejected exec carries; each absent when missing or mistyped. */
export type ExecFailure = v.InferOutput<typeof ExecFailureSchema>;

/**
 * Reads the `code`/`stdout`/`stderr` that execFile and `defaultCapture` attach
 * to a rejection. Anything else, a spawn failure or a non-object, reads as `{}`.
 */
export function readExecFailure(cause: unknown): ExecFailure {
  const parsed = v.safeParse(ExecFailureSchema, cause);

  return parsed.success ? parsed.output : {};
}

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
