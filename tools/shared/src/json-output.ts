// The tools CLIs' JSON flags: `--json-out <path>` (`-` is stdout), and `--json` for `--json-out -`.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Where a run's JSON document goes. */
export type JsonOutput =
  | { kind: 'none' }
  | { kind: 'stdout' }
  | { kind: 'file'; path: string };

/** Options for {@link jsonOutput}. */
export interface JsonOutputOptions {
  /** Where the JSON lands without either flag; without it the run writes none. */
  defaultPath?: string;
  /** The script takes positionals, so an argument after `--json` is one of them. */
  positionals?: boolean;
}

const JSON_FLAG = '--json';

const JSON_OUT_FLAG = '--json-out';

/** The `--json-out` value, `undefined` without the flag. */
function jsonOutValue(argv: readonly string[]): string | undefined {
  const flag = argv.indexOf(JSON_OUT_FLAG);

  if (flag === -1) return undefined;

  const value = argv[flag + 1];

  if (!value || value.startsWith('--'))
    throw new Error(
      `${JSON_OUT_FLAG} requires a file path argument, or - for stdout`,
    );

  return value;
}

/** The run's JSON destination from its arguments; throws on a malformed or conflicting pair. */
export function jsonOutput(
  argv: readonly string[],
  options: JsonOutputOptions & { defaultPath: string },
): Exclude<JsonOutput, { kind: 'none' }>;

export function jsonOutput(
  argv: readonly string[],
  options?: JsonOutputOptions,
): JsonOutput;

export function jsonOutput(
  argv: readonly string[],
  { defaultPath, positionals = false }: JsonOutputOptions = {},
): JsonOutput {
  const flag = argv.indexOf(JSON_FLAG);
  const outValue = jsonOutValue(argv);

  if (flag !== -1) {
    const next = argv[flag + 1];

    if (!positionals && next !== undefined && !next.startsWith('--'))
      throw new Error(
        `${JSON_FLAG} takes no value and prints to stdout; write a file with ${JSON_OUT_FLAG} ${next}`,
      );

    if (outValue !== undefined && outValue !== '-')
      throw new Error(
        `${JSON_FLAG} prints to stdout and ${JSON_OUT_FLAG} writes ${outValue}; pass one destination`,
      );

    return { kind: 'stdout' };
  }

  if (outValue === '-') return { kind: 'stdout' };

  if (outValue !== undefined) return { kind: 'file', path: outValue };

  return defaultPath === undefined
    ? { kind: 'none' }
    : { kind: 'file', path: defaultPath };
}

/** `argv` without `--json`, `--json-out` and its value, leaving the script's own arguments. */
export function withoutJsonFlags(argv: readonly string[]): string[] {
  const outFlag = argv.indexOf(JSON_OUT_FLAG);

  return argv.filter(
    (arg, index) =>
      arg !== JSON_FLAG &&
      (outFlag === -1 || (index !== outFlag && index !== outFlag + 1)),
  );
}

/** Writes `text` to the destination: stdout, the file (creating its directory), or nowhere. */
export async function writeJsonOutput(
  output: JsonOutput,
  text: string,
): Promise<void> {
  if (output.kind === 'none') return;

  if (output.kind === 'stdout') {
    process.stdout.write(text);

    return;
  }

  await mkdir(dirname(output.path), { recursive: true });
  await writeFile(output.path, text);
}
