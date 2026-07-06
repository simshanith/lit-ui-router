# sample-app-shared

Internal (private, source-only) package holding everything the sample apps
have in common: the contacts/mymessages/prefs feature modules, router
configuration, data sources, styles, and the simulated REST fixtures in
`public/`.

The apps — `sample-app-lit` and `sample-app-lit-mobx` — differ only in their
reactivity idiom, so each app keeps just the handful of modules that express
that idiom:

- `src/app/global/appConfig.ts` and `authService.ts` — plain singletons vs
  MobX observables
- `src/app/main/App.ts` and `NavHeader.ts` — `TransitionController` vs
  `ReactionController` / `RouterReactionController`
- `src/app/mymessages/Compose.ts` and `MessageList.ts` — plus each app's
  store helper (`storeCommitController.ts` / `messagesStore.ts`)

## How the inversion works

Shared code imports those app-provided modules through the `~app/*` alias
(e.g. `import AppConfig from '~app/global/appConfig.js'`). Each app maps the
alias to its own `src/app/` directory:

- **vite** — `resolve.alias` in the app's `vite.config.ts`
- **tsc** — `paths` in the app's `tsconfig.json`

This package's own `tsconfig.json` maps `~app/*` to the vanilla app so the
shared sources typecheck standalone (editors, eslint). There is no build
step: apps consume the TypeScript sources directly via the package `exports`
(`sample-app-shared/app/...js` resolves to `./src/app/....ts`).

## Adding to the shared surface

If a module is identical in both apps, move it here and keep relative
imports. If it needs to reach an app-specific module, import it via
`~app/*` — both apps must then provide that module at the same path with a
compatible interface.
