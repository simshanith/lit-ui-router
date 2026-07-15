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

## Mount-agnostic shell (proposal)

_Status: sketch. Tracks the "Mount-agnostic shell" thread on
[#313](https://github.com/simshanith/lit-ui-router/issues/313). The current
live behavior is per-mount base-baked builds
([#363](https://github.com/simshanith/lit-ui-router/pull/363))._

The docs site runs the vanilla app behind several mounts (`/app`,
`/not-found-naive`, `/not-found-spa`, `/simulated-routing`) to exhibit points on
the [server-support spectrum](../docs/guides/server-route-matching.md). Today
each is a **separate build** whose only difference is the baked
`VITE_SAMPLE_APP_BASE_URL` — the `<base href>` the pushState plugin strips.
Assets already emit at absolute `/assets/…`, so the JS, CSS, and HTML are
otherwise byte-identical: four builds exist to write four strings into one
`<base>` element.

Derive that base **at runtime** and the four collapse to one shell, served
everywhere. Two builds stay separate for real reasons — `/app-mobx` is a
different app (MobX bindings), `/app-hash` bakes the *location plugin* (`hash`),
which changes behavior, not just a string — but both drop their base bake too,
leaving a base-free floor of three builds.

| Artifact                      | Today (per-mount builds)    | Mount-agnostic shell |
| ----------------------------- | --------------------------- | -------------------- |
| Vanilla pushState builds      | 4                           | **1**                |
| Total vanilla-family builds   | 6 (4 + mobx + hash)         | **3**                |
| Base-carrying `.env` files    | 4 (`.env` + 3 exhibit envs) | **0**                |
| Exhibit `build:*` turbo tasks | 3                           | **0**                |
| Shell HTML files in `dist/`   | 6                           | **3**                |

**Mechanism.** `@uirouter/core`'s pushState location reads the base from the
`<base href>` tag at plugin-install time (`browserLocationConfig.getBaseHref()`
→ `document.getElementsByTagName('base')[0]`). Today's `configureRouter` already
*creates* that element — from `import.meta.env.VITE_SAMPLE_APP_BASE_URL`. Swap
the source from build-time env to a runtime derivation and nothing downstream
changes:

```ts
// router.config.ts — replaces the import.meta.env.VITE_SAMPLE_APP_BASE_URL block
import { shellMounts } from 'sample-app-routes'; // Object.keys(mounts) + '/not-found-naive'

// One build serves every prefix; recover the base from where we were served —
// the longest configured mount prefix that location.pathname sits under. The
// `+ '/'` boundary stops `/app` from swallowing `/app-hash` or `/app-mobx`.
const path = location.pathname;
const base = shellMounts
  .filter((m) => path === m || path.startsWith(m + '/'))
  .sort((a, b) => b.length - a.length)[0];
if (base) {
  const el = document.createElement('base');
  el.href = base + '/';
  document.head.appendChild(el);
}
```

This runs before `router.plugin(locationPlugin)`, so the plugin reads the
correct base exactly as before. `/app/welcome` → base `/app/` → matches
`/welcome`; `/not-found-naive/x` → base `/not-found-naive/` → `otherwise` →
in-app 404 (the soft-404 demo still holds); `/app-hash/x` does **not** match
`/app` (boundary guard). The worker then points every vanilla mount's
`shellPath` at one file, and the docs `viteStaticCopy` fan-out drops from eight
targets to two.

> **API note for #313.** That thread proposes
> `router.urlService.config.baseHref(...)` as a programmatic setter. In the
> installed core (6.1.2) the setter branch is real at the *location-config*
> layer (`BrowserLocationConfig.baseHref(href)` caches the argument), but the
> public `UrlConfig` facade types it **getter-only** (`baseHref: () => string`),
> so calling it as a setter needs a cast. Setting the `<base>` element (above)
> is the typed, robust path — it's the same DOM `getBaseHref()` ultimately
> reads, and it keeps `configureRouter`'s existing injection machinery.

The `+ '/'` boundary means the derivation is **gated on known entries** — an
unmatched prefix yields no base, so the app boots at `/` and 404s honestly
rather than mis-stripping. The `shellMounts` list *is* that gate.

**Why client-derived, not server-injected.** The alternative is for the worker
to inject `<base href="${mount}/">` into the shell via `HTMLRewriter` at request
time — "purest agnostic" (the client carries no mount knowledge, adding a mount
touches nothing). But #313 explicitly wants **no HTML templating**, and it costs
a request-time transform in *two* runtimes (worker + `vitepress dev` middleware)
plus a `transformShell` seam in `ui-router-server`. Both variants collapse the
builds equally; the client-derived one spends strictly less machinery, at the
cost of one shared `shellMounts` export the client and worker both read (guard
drift with a `shellMounts ⊇ Object.keys(mounts)` unit test).

**Why not the server's `Link` header?** The adapter already emits the canonical
URL (mount + path) as a `Link` **response header** on shell-200s — tempting as a
base source. But a page has **no API to read the response headers of its own
document navigation** (`Navigation`/`Resource` Timing expose timing, not
headers), so the client can't pick the base off the `Link` of the HTML it's
running in. Making a server value client-readable means either putting it in the
HTML body (per-request templating — #313's objection, and if you template you'd
inject `<base>` directly, i.e. server-injection above), an extra boot-time
`fetch()` to re-read the header (a round-trip for a prefix already in
`location.pathname`), or a Service Worker (inactive on first load,
disproportionate). The one readable server channel that avoids templating is a
**path-scoped cookie** (`Set-Cookie: … ; Path=/mount/`, read via
`document.cookie`) — it works, but bloats every request and risks cross-mount
staleness, strictly heavier than the gated pathname match for the same answer.

**Landing order.** (1) export `shellMounts` + its drift test; (2) runtime
derivation in `router.config.ts`, keeping the env read as a one-commit fallback,
then removing it; (3) delete the exhibit `.env` files, `build:*` scripts, and
`turbo.json` entries; (4) collapse the worker `shellPath` + dev `SHELL_PATHS` +
static-copy targets to one vanilla shell, drop base from `.env`/`.env.hash`. The
[docs Cypress matrix](./sample-app-lit-e2e/README.md) is the proof — its 16
specs encode the same behavior contract, so if they pass against one shell, only
the build count moved.
