# sample-app-shared

Internal (private, source-only) package holding everything the sample apps
have in common: the contacts/mymessages/prefs feature modules, router
configuration, data sources, styles, and the simulated REST fixtures in
`public/`.

The apps — `sample-app-lit-vanilla`, `sample-app-lit-mobx`,
`sample-app-lit-effect` and `sample-app-lit-signals` — differ only in their reactivity idiom, so each app
keeps just the handful of modules that express that idiom:

- `src/app/global/appConfig.ts` and `authService.ts` — plain singletons vs
  MobX observables vs Effect `SubscriptionRef`s vs `Signal.State`s
- `src/app/main/App.ts` and `NavHeader.ts` — `TransitionController` vs
  `ReactionController` / `RouterReactionController` vs `RefController` /
  `RouterRefController` vs `SignalWatcher` / `RouterSignalController`
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

## The state tables

The states' names, urls, params, parents and resolve tokens live in
data-only tables, one per module on its own subpath
(`sample-app-routes/state-table/app`, `/contacts`, `/mymessages`,
`/prefs`). The `app` table also holds each lazy module's future state. The
server mounts read all of them, through `sample-app-routes/state-table`, as
their routes.

Each `src/app/*/states.ts` binds components, resolve functions and
client-only config to its own table by state name (`src/registry/bind.ts`),
so a lazy chunk carries only its own rows. The same file registers the
table's rows with `'ui-router-registry'` (`RegisteredStates`) and asserts
they don't collide (`AssertNoCollisions`), so no app augments the registry.
The registration sits here rather than in the table package because one
row's param type (`mymessages.compose`'s `Partial<Message>` draft) names a
domain type the runtime-neutral tables can't import.
`src/registry/states.ts` holds those param types, each resolve token's
value type, and the resolves each state's views receive.

## Adding to the shared surface

If a module is identical in both apps, move it here and keep relative
imports. If it needs to reach an app-specific module, add the member to the
`AppModules` contract in `appModules.ts` and import the live binding — both
apps' `registerAppModules` call sites will then fail to typecheck until they
provide it.
