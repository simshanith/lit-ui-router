import type { MountDiagnostic, ServerRouter } from './index.ts';

// Shared by the warning builds and the Vite plugin, so whichever runs second finds the router reported.
const reported = new WeakSet<ServerRouter>();

/**
 * Passes each of a router's mount diagnostics to `warn`, once per router:
 * later calls for the same router do nothing.
 *
 * @param router - the router whose mounts to report
 * @param diagnose - `diagnoseMounts`, passed in so this module never imports the resolver
 * @param warn - receives each finding's message
 *
 * @internal
 */
export function reportMountDiagnostics(
  router: ServerRouter,
  diagnose: (router: ServerRouter) => MountDiagnostic[],
  warn: (message: string) => void,
): void {
  if (reported.has(router)) return;
  reported.add(router);

  for (const { message } of diagnose(router)) warn(message);
}
