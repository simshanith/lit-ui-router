// The vite plugin's stdout/stderr drain: #node-output reaches this file under the `node` condition only.
interface OutputStream {
  write(chunk: string, callback: () => void): boolean;
}

declare const process: {
  readonly stdout: OutputStream;
  readonly stderr: OutputStream;
};

const drained = (stream: OutputStream): Promise<void> =>
  new Promise((resolve) => stream.write('', () => resolve()));

/**
 * Resolves once this process's stdout and stderr have written every chunk
 * queued before the call.
 *
 * @internal
 */
export const drainOutput = async (): Promise<void> => {
  await Promise.all([drained(process.stdout), drained(process.stderr)]);
};
