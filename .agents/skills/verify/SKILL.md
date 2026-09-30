---
name: verify
description: Run a sample app on a vite dev server and drive it with one Cypress spec to verify changes end-to-end. Use when a change to apps/sample-app-lit-vanilla, apps/sample-app-lit-mobx, apps/sample-app-lit-effect, or the packages they consume needs runtime verification.
---

# Verify sample-app changes at runtime

| App                      | Pinned port | Base path      | Alt port |
| ------------------------ | ----------- | -------------- | -------- |
| `sample-app-lit-vanilla` | 5173        | `/app/`        | 5273     |
| `sample-app-lit-mobx`    | 5174        | `/app-mobx/`   | 5274     |
| `sample-app-lit-effect`  | 5175        | `/app-effect/` | 5275     |

Use the alt ports: the pinned ports and e2e's :8787 are shared across
checkouts, so a maintainer's `turbo dev` or another worktree may hold them.
Run everything from the checkout root.

## 1. Build workspace deps

```bash
turbo run build --filter='sample-app-lit-vanilla^...' --output-logs=errors-only
```

Run turbo bare (not via pnpm), in the foreground. Swap in the app you need;
repeat `--filter` to cover several. If vite logs `Failed to resolve entry for package "lit-ui-router"`,
the deps aren't built: build, then restart vite.

## 2. Start one dev server on an alternate port

Run in the background, logging to a file:

```bash
pnpm --filter sample-app-lit-vanilla dev --port 5273 > "$TMPDIR/vite.log" 2>&1
```

The shared vite config sets `strictPort` and `open: false`, so a taken port
fails loudly and no browser opens. Wait for readiness:

```bash
curl -sf --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:5273/app/
```

vite-plugin-checker typechecks in-app; a TS error renders a full-screen
overlay that blocks Cypress clicks. Check the vite log for `ERROR(TypeScript)`
when clicks fail mysteriously. If the log instead says the checker's `tsc`
is missing, no overlay can appear; run `pnpm --filter <app> typecheck` instead.

## 3. Run one Cypress spec

Specs live in `apps/sample-app-lit-e2e/src/integration/*.cy.js`.

Vanilla: the base config's baseUrl reads `WWW_DEV_PORT`, so the repo script
works and forwards `--spec`:

```bash
WWW_DEV_PORT=5273 pnpm --dir apps/sample-app-lit-e2e test:e2e:vanilla --spec src/integration/dialog.cy.js
```

mobx and effect: `test:e2e:mobx|effect` (`scripts/cypress-suite.ts`) don't
forward `--spec`, so pass the same config the script builds:

```bash
pnpm --dir apps/sample-app-lit-e2e exec cypress run --config baseUrl=http://localhost:5275/app-effect/,videosFolder=cypress/videos-effect,screenshotsFolder=cypress/screenshots-effect --spec src/integration/dialog.cy.js
```

For mobx use port 5274, `/app-mobx/` and the `-mobx` folders.

Evidence lands under `apps/sample-app-lit-e2e/cypress/` (gitignored): video
always (`video: true`), as `videos*/<spec>.mp4`; screenshots only on failure
or from an explicit `cy.screenshot('name')`, in `screenshots*/`.

## 4. Stop the server

Kill only the vite you started:

```bash
lsof -tiTCP:5273 -sTCP:LISTEN   # confirm with ps that it is this worktree's vite
kill <pid>
```

## Flows worth knowing

- Login: visit `/login`, select `myself@angular.dev`, click "Log in". Specs
  cache `sessionStorage.appConfig` across tests in `beforeEach`
  (`dialog.cy.js`).
- Confirm dialog: contact → "Edit Contact" → "Delete"; delete lives on the
  edit view. The dialog is `.dialog .content`; clicking the bottom of
  `.dialog#modal` dismisses it and `#backdrop` goes away. Render assertions
  (the `in` class, backdrop dim) live in
  `apps/sample-app-shared/src/app/global/Dialog.spec.ts`.
- The full production-like run (`mise run test_e2e`) builds the docs site and
  serves every app through wrangler on :8787. Don't use it for iteration.
