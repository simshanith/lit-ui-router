/**
 * Resolves once the process's output is written: at once off node.
 *
 * @internal
 */
export const drainOutput = (): Promise<void> => Promise.resolve();
