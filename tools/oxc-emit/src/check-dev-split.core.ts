// Pure logic for the dev/prod split gate — no filesystem here, so every unit is
// directly testable with plain fixtures (see check-dev-split.test.ts). The IO
// (reading dist/ and dist/development/) lives in check-dev-split.ts.
import { posix } from 'node:path';

/** Every message a package logs is prefixed with its own name. */
export const messagePrefix = (packageName: string): string =>
  `${packageName}: `;

// A message chunk as it survives into emitted code: template literals break at
// the first interpolated quote, so match up to the next quote character. Built
// per package, so `lit-ui-router-mobx: ` is not mistaken for `lit-ui-router: `.
const messageChunks = (prefix: string): RegExp =>
  new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\`'"]*`, 'g');

export type DevSplitInput = {
  /** The package's own message prefix, e.g. `lit-ui-router: `. */
  prefix: string;
  /** Message prefixes that must ship in development only. */
  devOnly: string[];
  /** Concatenated `dist/*.js`. */
  production: string;
  /** Concatenated `dist/development/*.js`. */
  development: string;
};

/**
 * Violations of the split contract, as human-readable strings:
 *
 * - every declared dev-only message must be present in the development emit —
 *   otherwise the guard swallowed a warning consumers still need;
 * - none may be present in the production emit — the point of the split;
 * - any message the development emit carries and the production emit does not
 *   must be declared, so a new dev-only warning cannot land unlisted.
 */
export function findDevSplitViolations({
  prefix,
  devOnly,
  production,
  development,
}: DevSplitInput): string[] {
  const violations: string[] = [];

  for (const message of devOnly) {
    if (!development.includes(message)) {
      violations.push(
        `declared dev-only message is missing from dist/development: ${JSON.stringify(message)}`,
      );
    }

    if (production.includes(message)) {
      violations.push(
        `dev-only message leaked into dist: ${JSON.stringify(message)}`,
      );
    }
  }

  for (const chunk of new Set(development.match(messageChunks(prefix)) ?? [])) {
    if (production.includes(chunk)) continue;

    if (devOnly.some((message) => chunk.startsWith(message))) continue;
    violations.push(
      `dist/development carries an undeclared dev-only message: ${JSON.stringify(chunk)}`,
    );
  }

  return violations;
}

/** Conditions to targets, the shape this repo's package.json#imports entries take. */
export type ImportsMap = Readonly<
  Record<string, Readonly<Record<string, string>>>
>;

/** A `node` target of package.json#imports, as each emit tree holds it. */
export function nodeImportRoots(
  imports: ImportsMap | undefined,
  trees: readonly string[],
): string[] {
  return Object.values(imports ?? {}).flatMap(({ node }) =>
    node?.startsWith('./dist/')
      ? trees.map((tree) => posix.join(tree, node.slice('./dist/'.length)))
      : [],
  );
}

const RELATIVE_SPECIFIER = /(?:from|import)\s*"(\.\.?\/[^"]+)"/g;

const PROCESS = /\bprocess\b/;

/**
 * Emitted files that mention `process` outside the static graph of the
 * package's package.json#imports `node` targets: every other file can reach a
 * runtime without `process`, Workers and browsers among them.
 *
 * @param files - each emitted `.js` path under dist/, with its code
 * @param roots - the `node` targets in each emit tree, from {@link nodeImportRoots}
 */
export function findProcessReads(
  files: ReadonlyMap<string, string>,
  roots: readonly string[],
): string[] {
  const reached = new Set<string>();
  const queue = [...roots];

  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    const code = files.get(file);

    if (code === undefined || reached.has(file)) continue;
    reached.add(file);

    for (const [, specifier] of code.matchAll(RELATIVE_SPECIFIER))
      queue.push(posix.join(posix.dirname(file), specifier));
  }

  return [...files].flatMap(([file, code]) =>
    !reached.has(file) && PROCESS.test(code)
      ? [
          `${file} mentions process, which only a package.json#imports node target may read`,
        ]
      : [],
  );
}

export type Report = { ok: boolean; text: string };

/** Render the human-readable report. */
export function formatDevSplitReport(
  violations: string[],
  declared: number,
): Report {
  if (violations.length === 0) {
    return {
      ok: true,
      text: `✓ dev/prod split holds — ${declared} dev-only messages ship in dist/development only.`,
    };
  }

  return {
    ok: false,
    text: [
      '✗ dev/prod split check failed:',
      ...violations.map((violation) => `  • ${violation}`),
    ].join('\n'),
  };
}
