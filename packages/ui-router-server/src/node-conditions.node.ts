// The vite plugin's one `process` read: #node-conditions reaches this file under the `node` condition only.
declare const process: {
  readonly execArgv: readonly string[];
  readonly env: { readonly NODE_OPTIONS?: string };
};

const CONDITIONS_FLAG = /^(?:--conditions|-C)(?:=(.+))?$/;

/**
 * The `--conditions` node runs with, from `execArgv` and `NODE_OPTIONS`.
 *
 * @internal
 */
export const nodeConditions = (
  execArgv: readonly string[] = process.execArgv,
  // oxlint-disable-next-line turbo/no-undeclared-env-vars -- read in the consumer's vite build, never by a turbo task
  nodeOptions: string = process.env.NODE_OPTIONS ?? '',
): string[] => {
  const args = [...execArgv, ...nodeOptions.split(/\s+/)];

  return args.flatMap((arg, index) => {
    const match = CONDITIONS_FLAG.exec(arg);

    if (!match) return [];

    const value = match[1] ?? args[index + 1];

    return value === undefined ? [] : [value];
  });
};
