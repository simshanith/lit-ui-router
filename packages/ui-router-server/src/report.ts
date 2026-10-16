import type { ServerRouter } from './index.ts';

// Shared by the development build and the Vite plugin, so whichever runs second finds the router reported.
const reported = new WeakSet<ServerRouter>();

/**
 * Passes each of a router's {@link ServerRouter.diagnose} messages to `warn`,
 * once per router: later calls for the same router do nothing.
 *
 * @param router - the router whose mounts to report
 * @param warn - receives each finding's message
 *
 * @internal
 */
export function reportMountDiagnostics(
  router: ServerRouter,
  warn: (message: string) => void,
): void {
  if (reported.has(router)) return;
  reported.add(router);

  for (const { message } of router.diagnose()) warn(message);
}
