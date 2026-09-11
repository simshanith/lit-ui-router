// The www dev-server port lives here, in code, so every entry point works
// without mise; WWW_DEV_PORT overrides it — for a second worktree, a CI matrix
// leg — and mise's [env] is only one way to set that (#697).
export const DEFAULT_WWW_DEV_PORT = 8787;

// `raw` is the override if there is one; empty or absent means there isn't.
// `name` only shapes the error, for callers whose override rides another var.
export function resolveWwwDevPort(
  raw: string | undefined = process.env.WWW_DEV_PORT,
  name = 'WWW_DEV_PORT',
): number {
  const value = raw?.trim();
  if (!value) return DEFAULT_WWW_DEV_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`${name} is not a valid port number: ${value}`);
  return port;
}
