// Env-contract helpers for the release entries: every tool a mise task wraps
// reads its inputs from environment variables (workflow step `env:` blocks —
// never `${{ }}` interpolated into run lines), so a missing or malformed
// value must fail loudly with the variable's name.

export type Env = Record<string, string | undefined>;

/** The trimmed value of a required environment variable; throws when unset or blank. */
export function requireEnv(env: Env, name: string): string {
  const value = env[name]?.trim() ?? '';
  if (value === '') {
    throw new Error(`missing required environment variable ${name}`);
  }
  return value;
}

/**
 * GitHub Actions renders boolean inputs as the strings 'true'/'false', and an
 * input absent from the event (e.g. dryRun on a tag push) as ''. Only the
 * exact string 'true' enables — everything else, including unset, is false,
 * matching the old `${{ inputs.dryRun && … }}` conditionals.
 */
export function boolEnv(env: Env, name: string): boolean {
  return env[name]?.trim() === 'true';
}
