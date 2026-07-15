// The prefixes the mount-agnostic shell is served under. Kept as a plain,
// dependency-free string list — and exposed on its own `./shell-mounts` subpath
// — so the client (sample-app-shared's configureRouter) can import it WITHOUT
// pulling ui-router-server's source types across the tsconfig boundary that the
// `mounts` table in routes.ts sits behind. configureRouter matches
// location.pathname against these at boot to recover its <base href>, so one
// build per app deep-links under every prefix (see routes.ts and docs/worker).
//
// `/not-found-naive` has no MountConfig — the worker serves it with routing
// turned OFF, on purpose — so it is listed here alongside the routed mounts.
// The routes test pins this list as an exact mirror of the mount keys plus the
// naive exhibit, so a new or renamed mount can't silently miss its base.
export const shellMounts: readonly string[] = [
  '/app',
  '/app-mobx',
  '/app-hash',
  '/not-found-spa',
  '/simulated-routing',
  '/not-found-naive',
];
