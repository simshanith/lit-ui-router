---
name: verify
description: Run a sample app on a vite dev server and drive it with one Cypress spec to verify changes end-to-end. Use when a change to apps/sample-app-lit-vanilla, apps/sample-app-lit-mobx, apps/sample-app-lit-effect, or the packages they consume needs runtime verification.
---

# Verify sample-app changes at runtime

The recipe lives in
[apps/sample-app-lit-e2e/README.md](../../../apps/sample-app-lit-e2e/README.md#iterating-against-a-dev-server);
the specs in `apps/sample-app-lit-e2e/src/integration/` are the reference for
each flow. This skill adds only what an unattended run needs.

1. Build deps in the foreground: `turbo run build --filter='<app>^...' --output-logs=errors-only`.
2. Pick an alt port, never the pinned ones (5173–5175) or e2e's :8787; another
   checkout may hold them. Use 5273 / 5274 / 5275 for vanilla / mobx / effect.
3. Start the dev server in the background, logging to a file:
   `pnpm --filter <app> dev --port <alt>`. Wait for it:
   `curl -sf --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:<alt>/<base>/`.
4. Run one spec per the README, with the alt port: `WWW_DEV_PORT=<alt>` for
   vanilla, the `--config baseUrl=…` form for mobx and effect.
5. If clicks fail, check the vite log for `ERROR(TypeScript)`: the checker's
   overlay blocks Cypress. A clean pass logs `[TypeScript] No errors`.
6. Stop only the server you started: `lsof -tiTCP:<alt> -sTCP:LISTEN`, confirm
   with `ps`, then `kill`.

Report the spec's pass/fail counts and the video path under
`apps/sample-app-lit-e2e/cypress/videos*/`.
