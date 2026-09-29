---
name: verify
description: Run a sample app and drive it with Cypress to verify changes end-to-end. Use when a change to apps/sample-app-lit-vanilla, apps/sample-app-lit-mobx, or the packages they consume needs runtime verification.
---

# Verify sample-app changes at runtime

## Build workspace deps (fresh worktree)

```bash
pnpm install --prefer-offline
turbo run build --filter='sample-app-lit-vanilla^...' --output-logs=errors-only 2>&1
```

Run turbo bare (not via pnpm), in the foreground with `2>&1`.
If vite logs `Failed to resolve entry for package "lit-ui-router"`, the
workspace packages aren't built — build, then restart vite.

## Launch a dev server

```bash
cd apps/sample-app-lit-vanilla &&  BROWSER=none pnpm exec vite --port 5273 --strictPort   # serves /app/
cd apps/sample-app-lit-mobx && BROWSER=none pnpm exec vite --port 5283 --strictPort   # serves /app-mobx/
```

`BROWSER=none` suppresses `server.open`. Each app's `<base href>` comes from
`VITE_SAMPLE_APP_BASE_URL` in its `.env` (`/app/`, `/app-mobx/`), so hit
`http://localhost:5273/app/...`; vite's SPA fallback handles the prefix.
Never use ports 5173/5174 — they belong to the user's own dev servers.
vite-plugin-checker typechecks in-app: TS errors render as a full-screen
overlay (`li.message-item`) that breaks Cypress interactions — check the vite
log for `ERROR(TypeScript)` if clicks mysteriously fail.

## Drive with Cypress (evidence: screenshots + video)

Specs live in `apps/sample-app-lit-e2e/src/integration/*.cy.js`. Run one
against a dev server by overriding baseUrl:

```bash
cd apps/sample-app-lit-e2e
pnpm exec cypress run --config baseUrl=http://localhost:5273/app/ --spec ./src/integration/dialog.cy.js
# mobx: --config baseUrl=http://localhost:5283/app-mobx/,screenshotsFolder=cypress/screenshots-mobx
```

Screenshots land in `cypress/screenshots*/`, videos in `cypress/videos/`
(gitignored). `cy.screenshot('name')` in a spec captures deliberate evidence.

## Flows worth knowing

- Login: `/login`, select `myself@angular.dev`, click "Log in"; cache
  `sessionStorage.appConfig` across tests (see existing specs' beforeEach).
- Confirm dialog: contact → "Edit Contact" → "Delete" (delete lives on the
  edit view, not the contact view). lit-dialog renders Bootstrap modal markup
  (`#backdrop` + `#modal > .modal-dialog > .modal-content`, siblings inside
  `<sample-dialog>`); Dialog.ts aliases these with
  `.dialog/.backdrop/.wrapper/.content`. lit-dialog adds `in` on open; clicking
  `#modal`'s empty area or Esc cancels. The backdrop sits _under_ the modal, so Cypress
  `be.visible` fails on it — assert class/opacity instead.
- The full production-like e2e (`pnpm test` in sample-app-lit-e2e) builds docs
  and serves both apps via wrangler on :8787 — slow; prefer vite + baseUrl
  override for iteration.
