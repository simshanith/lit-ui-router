---
name: playwright-sample-app
description: Run a sample app on a vite dev server and drive it with one Playwright spec, or explore it with playwright-cli, to verify changes end-to-end. Use when a change to apps/sample-app-lit-vanilla, apps/sample-app-lit-mobx, apps/sample-app-lit-effect, apps/sample-app-lit-signals, or the packages they consume needs runtime verification.
---

# Verify sample-app changes at runtime

The recipe lives in
[apps/sample-app-lit-e2e/README.md](../../../apps/sample-app-lit-e2e/README.md#iterating-against-a-dev-server);
the specs in `apps/sample-app-lit-e2e/src/playwright/app/` are the reference for
each flow. This skill adds only what an unattended run needs.

1. Build deps in the foreground: `turbo run build --filter='<app>^...' --output-logs=errors-only`.
2. Pick an alt port, never the pinned ones (5173–5176) or e2e's :8787; another
   checkout may hold them. Use 5273 / 5274 / 5275 / 5276 for vanilla / mobx / effect / signals.
3. Start the dev server in the background, logging to a file:
   `pnpm --filter <app> dev --port <alt>`. Wait for it:
   `curl -sf --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:<alt>/<base>/`.
4. Run one spec per the README with `WWW_DEV_PORT=<alt>` and the app's suite
   script (`test:e2e:vanilla`, `test:e2e:mobx`, `test:e2e:effect`, `test:e2e:signals`).
   Never `e2e`: UI mode waits for a human.
   With no spec near the change, explore with `playwright-cli` per the README
   instead, from the repo root and in a named session (`-s=<task>`) so parallel
   agents never share a browser. Ignore its update notice: the catalog owns the
   version. If `open` fails on a missing browser, run the README's
   `install-browser` step.
5. If clicks time out, check the vite log for `ERROR(TypeScript)`: the checker's
   overlay covers the page. A clean pass logs `[TypeScript] No errors`.
6. Stop only the server you started: `lsof -tiTCP:<alt> -sTCP:LISTEN`, confirm
   with `ps`, then `kill`. Close a `playwright-cli` session with
   `pnpm exec playwright-cli -s=<task> close`.

Report the spec's pass/fail counts, and for a failure the trace under
`apps/sample-app-lit-e2e/test-results/<suite>/`. Report a `playwright-cli`
finding with its snapshot or screenshot from `.playwright-cli/`, and write it
up as a spec.
