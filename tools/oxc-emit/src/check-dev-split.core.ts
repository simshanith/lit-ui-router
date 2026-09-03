// Pure logic for the dev/prod split gate — no filesystem here, so every unit is
// directly testable with plain fixtures (see check-dev-split.test.ts). The IO
// (reading dist/ and dist/development/) lives in check-dev-split.ts.

/** Every message this package logs is prefixed with its own name. */
export const MESSAGE_PREFIX = 'lit-ui-router: ';

// A message chunk as it survives into emitted code: template literals break at
// the first interpolated quote, so match up to the next quote character.
const MESSAGE_CHUNK = /lit-ui-router: [^`'"]*/g;

export type DevSplitInput = {
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

  for (const chunk of new Set(development.match(MESSAGE_CHUNK) ?? [])) {
    if (production.includes(chunk)) continue;
    if (devOnly.some((message) => chunk.startsWith(message))) continue;
    violations.push(
      `dist/development carries an undeclared dev-only message: ${JSON.stringify(chunk)}`,
    );
  }

  return violations;
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
