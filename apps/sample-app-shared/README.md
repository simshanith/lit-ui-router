# sample-app-shared

Internal (private, source-only) package holding everything the sample apps
have in common: the contacts/mymessages/prefs feature modules, router
configuration, data sources, styles, and the simulated REST fixtures in
`public/`.

The apps — `sample-app-lit-vanilla` and `sample-app-lit-mobx` — differ only in their
reactivity idiom, so each app keeps just the handful of modules that express
that idiom:

- `src/app/global/appConfig.ts` and `authService.ts` — plain singletons vs
  MobX observables
- `src/app/main/App.ts` and `NavHeader.ts` — `TransitionController` vs
  `ReactionController` / `RouterReactionController`
- `src/app/mymessages/Compose.ts` and `MessageList.ts` — plus each app's
  store helper (`storeCommitController.ts` / `messagesStore.ts`)

## How the inversion works

`src/app/global/appModules.ts` is the contract: it declares the types of the
app-provided modules and exports them as (initially unassigned) live
bindings. Each app's `src/main.ts` implements the contract, calls
`registerAppModules({ AppConfig, AuthService, App, Compose, MessageList })`,
and then boots the shared entry point with `await import('sample-app-shared/main.js')`.

Shared code just imports the bindings — e.g.
`import { AppConfig } from './appModules.js'` — and because ESM exports are
live, every read after registration sees the app's implementation. The one
rule this imposes: shared code must read these bindings lazily (inside
constructors, methods, or lazy-loaded state definitions), never at module
scope, since shared modules evaluate before `registerAppModules` runs. Work
that must start eagerly can `await appModulesRegistered` instead (see the
mobx app's `messagesStore.ts`).

There is no build step: apps consume the TypeScript sources directly via the
package `exports` (`sample-app-shared/app/...js` resolves to
`./src/app/....ts`).

## Adding to the shared surface

If a module is identical in both apps, move it here and keep relative
imports. If it needs to reach an app-specific module, add the member to the
`AppModules` contract in `appModules.ts` and import the live binding — both
apps' `registerAppModules` call sites will then fail to typecheck until they
provide it.
