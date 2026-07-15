# Sample apps

This workspace holds two behaviorally identical sample applications — the
same non-trivial ui-router lit app, written twice so the reactivity idioms
can be compared file-by-file, in the spirit of [TodoMVC](https://todomvc.com)
and the [ui-router sample apps](https://github.com/ui-router/sample-app-react)
— plus the code they share and the test suite that keeps them identical.

| Package                                               | What it is                                                                                                              |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [`sample-app-lit-vanilla`](./sample-app-lit-vanilla/) | The zero-dependency idiom: `lit-ui-router`'s `TransitionController`. Served at `/app/` on the docs site.                |
| [`sample-app-lit-mobx`](./sample-app-lit-mobx/)       | The [MobX](https://mobx.js.org) idiom: `lit-ui-router-mobx`'s reaction controllers. Served at `/app-mobx/`.             |
| [`sample-app-shared`](./sample-app-shared/)           | Private, source-only package with everything the apps have in common: feature modules, router config, styles, fixtures. |
| [`sample-app-lit-e2e`](./sample-app-lit-e2e/)         | One Cypress suite, run against both apps — this is what enforces the behavioral identity.                               |

## How an app is assembled

Each app keeps only the handful of modules that express its idiom. Its
`src/main.ts` provides them to the shared code via the typed DI contract
(`registerAppModules` in `sample-app-shared/app/global/appModules.ts`), then
boots the shared entry point. See the
[`sample-app-shared` README](./sample-app-shared/README.md) for how the
inversion works and how to grow the shared surface.

## What differs between the apps

| Module                                         | `sample-app-lit-vanilla`                                                                | `sample-app-lit-mobx`                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `global/appConfig.ts`, `global/authService.ts` | Plain singletons                                                                        | MobX observables (`makeAutoObservable`)                                                |
| `main/App.ts`                                  | `TransitionController` re-renders on router transitions                                 | `RouterReactionController` observes the router via the observable `RouterStore`        |
| `main/NavHeader.ts`                            | `TransitionController`                                                                  | `ReactionController` selector over the observable auth state                           |
| `mymessages/Compose.ts`                        | `TransitionController` reads the `message` param per transition                         | `RouterReactionController` reacts to the observable route param                        |
| `mymessages/MessageList.ts`                    | `StoreCommitController` re-renders on the fake REST store's `commit` events             | `ReactionController` selector over the observable message cache                        |
| Store helper                                   | `util/storeCommitController.ts` — a `ReactiveController` wired to store `commit` events | `mymessages/messagesStore.ts` — an observable cache refreshed on store `commit` events |

Everything else — the contacts/mymessages/prefs features, router
configuration, transition hooks, data sources, dialogs, styles, and the
simulated REST fixtures in `public/` — is imported from `sample-app-shared`.

## Divergences from the upstream sample apps

The feature set tracks the ui-router sample apps, with one deliberate
addition: **404 handling**. The
[angularjs sample](https://github.com/ui-router/sample-app-angularjs) silently
redirects unmatched URLs to `/welcome`; the
[angular](https://github.com/ui-router/sample-app-angular) and
[react](https://github.com/ui-router/sample-app-react) samples don't handle
them at all. This app routes them to a dedicated `notFound` state that
preserves the URL, plus a transition hook that keeps the 404 from being
superseded when a URL matches a lazy-loaded future state's prefix but nothing
inside the loaded module. See the
[Unmatched URLs (404) guide](https://lit-ui-router.dev/guides/unmatched-urls)
for the full pattern.

## Location plugin selection

Both apps support three location strategies via `locationPluginConfig` in the
shared `router.config.ts`:

| Plugin       | URL Format | Browser Support                              |
| ------------ | ---------- | -------------------------------------------- |
| `hash`       | `/#/path`  | All browsers                                 |
| `pushState`  | `/path`    | Modern browsers                              |
| `navigation` | `/path`    | Chrome/Edge 102+, Firefox 147+, Safari 26.2+ |

**Auto-detection**: When `navigation` preference is set, the app automatically
selects the best available plugin:

1. Navigation API when supported, via the 🧑‍🔬 _experimental_
   [navigation plugin](../packages/navigation-location-plugin/)
2. Push State as fallback for unsupported browsers

**Override options** (in priority order):

1. URL parameter: `?feature-location-plugin=hash`
2. Session storage: Set via Feature Flags panel in Prefs
3. Environment variable: `VITE_SAMPLE_APP_LOCATION_PLUGIN=pushState`

The Feature Flags panel shows browser compatibility indicators for each plugin
option.

## Local development

`turbo dev` starts both apps' Vite dev servers on pinned ports —
`sample-app-lit-vanilla` on `:5173`, `sample-app-lit-mobx` on `:5174` — with
`strictPort` set, so a taken port fails loudly instead of silently drifting
to the next free one. Neither server auto-opens a browser. To run one app on
a different port, override it on the CLI:

```bash
pnpm --filter sample-app-lit-vanilla dev --port 5273
```

## End-to-end tests

`sample-app-lit-e2e` runs one Cypress suite against both apps, the docs site,
and every published location strategy. See the
[`sample-app-lit-e2e` README](./sample-app-lit-e2e/README.md).

## Mount-agnostic shell

The docs site runs the sample app behind several mounts — `/app`,
`/not-found-naive`, `/not-found-spa`, `/simulated-routing` — to exhibit points
on the [server-support spectrum](../docs/guides/server-route-matching.md). All
four share a **single vanilla build**: the client recovers its base prefix at
boot rather than having one baked in, so one build deep-links correctly under
every mount. Assets emit at absolute `/assets/…`, so nothing else varies by
prefix.

Two builds stay separate, because they differ in more than a base prefix — but
they recover their base the same way, so neither bakes one either:

| Build                                | Serves                                                             | Location  |
| ------------------------------------ | ------------------------------------------------------------------ | --------- |
| `sample-app-lit-vanilla` `dist`      | `/app`, `/not-found-naive`, `/not-found-spa`, `/simulated-routing` | pushState |
| `sample-app-lit-mobx` `dist`         | `/app-mobx`                                                        | pushState |
| `sample-app-lit-vanilla` `dist-hash` | `/app-hash`                                                        | hash      |

**Recovering the base.** `@uirouter/core`'s pushState location reads its base
from the `<base href>` tag at plugin-install time
(`browserLocationConfig.getBaseHref()` → `document.getElementsByTagName('base')`).
`configureRouter` creates that element at boot, deriving the href from
`location.pathname` — the longest mount prefix the path sits under — and falling
back to the build-time `VITE_SAMPLE_APP_BASE_URL` when served off a known mount
(the dev server at the root):

```ts
// router.config.ts
import { shellMounts } from 'sample-app-routes/shell-mounts';

const path = location.pathname;
const derived = shellMounts
  .filter((m) => path === m || path.startsWith(`${m}/`))
  .sort((a, b) => b.length - a.length)[0];
const BASE_URL =
  (derived && `${derived}/`) || import.meta.env.VITE_SAMPLE_APP_BASE_URL;
if (BASE_URL) {
  const el = document.createElement('base');
  el.href = BASE_URL;
  document.head.appendChild(el);
}
```

The derivation is gated on known entries: an unmatched prefix yields no derived
base, so the app boots at `/` rather than mis-stripping, and the `+ '/'`
boundary keeps `/app` from swallowing `/app-hash` or `/app-mobx`. So
`/app/welcome` → base `/app/` → matches `/welcome`; `/not-found-naive/x` → base
`/not-found-naive/` → `otherwise` → the in-app 404 (the soft-404 exhibit);
`/simulated-routing/welcome` → base `/simulated-routing/`. On the serving side
the docs worker points every vanilla mount at the one shell (`shellPath`), and
the dev server's `SHELL_PATHS` does the same.

**`shellMounts` lives on its own subpath.** The base-prefix list is a
dependency-free module (`sample-app-routes/src/shellMounts.ts`) exposed as the
`sample-app-routes/shell-mounts` subpath, deliberately not re-exported from the
`routes.ts` barrel. That barrel imports `ui-router-server` for its `MountConfig`
types; importing it from the client would pull the server package's source-only
`.ts` across the tsconfig boundary (the apps don't set
`allowImportingTsExtensions`). The subpath keeps the client free of
`ui-router-server` — it reads only plain strings. `sample-app-routes/test` pins
`shellMounts` as an exact mirror of the mount keys plus `/not-found-naive`
(which has no `MountConfig` — the worker serves it with routing off), so a new
or renamed mount can't silently miss its base.
