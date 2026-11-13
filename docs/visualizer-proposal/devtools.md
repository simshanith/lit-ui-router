# Devtools scope and ecosystem

A companion to the [visualizer proposal](README.md). That document covers the
panel. This one covers what a `ui-router-devtools` package can provide beyond
the panel, and which devtools hosts it can plug into.

Facts about `@uirouter/core` are from 6.1.2. Ecosystem facts were checked against
live docs and npm on 2026-11-11; items marked unverified were not.

## Scope

`ui-router-devtools` is an inspection toolkit for any `@uirouter/core` router:

- an adapter that turns a router into JSON-safe events, and a recorder over it;
- reporters with no UI: the console and the browser's Performance panel;
- a Lit-built panel showing states, transitions and why each ended as it did,
  URLs, params, views and resolves.

Views that need one adapter or the server (`lit-ui-router` views and links, SSR
hydration) live in optional subpaths with their own peers.

It is not a time-travel debugger, a browser extension, or a lint or build tool,
and it adds no inspection hooks to `lit-ui-router` or core. Gaps in core's
observability are raised upstream rather than patched in shipped code.

## One event stream, many surfaces

Every surface below reads the same adapter events.

| How it connects                   | Surfaces                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Directly, in the page             | The panel; Performance tracks; console reporter; test recorder; OpenTelemetry and Sentry span mapping; agent tools                             |
| Over a transport (`postMessage`)  | A panel on the docs page beside an example iframe; a Vite DevTools iframe dock; a browser extension, if one is ever built                      |
| Through a dev-only global hook    | Tools that arrive after the app: coding agents through `chrome-devtools-mcp`, Playwright, Cypress                                              |
| By mounting the element unchanged | TanStack Devtools `render(el)`; a Vite DevTools `custom-render` dock                                                                           |
| Needs more than the stream        | Server and prerender transitions (a Node-side adapter and an RPC bridge); static state diagrams (a dump step); per-hook timing (a core change) |

## What the devtools can provide

Tiers: **0** no UI; **1** panel, first release; **2** panel, later; **3** needs
a transport or an outside host; **4** build time. Cost is S, M or L.

### Recommended

| Capability                  | What the developer gets                                                                                           | Data                                                                                  | Cost | Tier |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---- | ---- |
| State outline and Map       | The tree, lazy and abstract markers, the active path                                                              | `stateRegistry.get()`, `onStatesChanged`, `stateService.target().$state()`; public    | S    | 1    |
| Transition log              | Numbered rows with entered, exited and retained states, outcome and duration                                      | `onBefore`, `treeChanges()`, `promise`, `Rejection.type`; public                      | S    | 1    |
| Why it did not navigate     | A plain reason on each ignored, superseded, aborted or invalid row                                                | `Rejection.type` and `detail`, `ignored()`, `onInvalid`; public                       | M    | 1    |
| Redirect chains and options | Chain rails; badges for source (link, URL, redirect), `replace`, `reload`, `inherit`                              | `redirectedFrom()`, `originalTransition()`, `options()`; public                       | S    | 1    |
| Param diff                  | Before and after values; dynamic params flagged                                                                   | `params('from')`, `params('to')`; public                                              | S    | 1    |
| Session export and import   | Download a session as JSON for a bug report; drop one into the panel                                              | Adapter events                                                                        | S    | 1    |
| Router config card          | Location plugin, base href, hash prefix, strict mode, plugin list                                                 | `urlService.config`, `getPlugin()`; public                                            | S    | 1    |
| Performance-panel track     | Transitions, phases and resolves as spans in Chrome's Performance panel; plain User Timing marks everywhere else  | `performance.measure` with `detail.devtools`                                          | S    | 0    |
| Console reporter            | One collapsed group per transition; a structured alternative to `trace`                                           | Adapter events                                                                        | S    | 0    |
| Recorder and test helper    | `record(router)` and assertions such as "ended at X after a redirect from Y"; attach the log to a failed e2e test | Adapter events                                                                        | S–M  | 0    |
| URL playground              | Type a URL and see the matched rule, state, params, and whether `otherwise` fired                                 | `urlService.match()`, `rules()`, `stateService.href()`; public                        | S–M  | 2    |
| Param editor and go         | A form built from the param schema; go, or copy the URL or a snippet                                              | `StateObject.parameters()`, `go()`; public                                            | M    | 2    |
| View tree and overlay       | `ui-view` nesting, named views, what fills each; highlight a view's element on the page                           | `viewService._pluginapi`; the element lookup needs a dev-only `lit-ui-router` subpath | M    | 2    |
| Link inspector              | Every link on the page with its state and params; dead targets flagged                                            | `urlService.match()` over `a[href]`; public                                           | M    | 2    |
| Resolve values and reuse    | Tokens per state, a value preview, and whether a resolve ran or was reused from a retained state                  | `injector().get()`, `getResolveTokens()`; public                                      | M    | 2    |
| Hooks registry              | Hooks per event with criteria, priority and invoke count                                                          | `transitionService._pluginapi.getHooks()`                                             | S–M  | 2    |
| SSR and hydration report    | Boot outcome and each view adopted or re-rendered                                                                 | `BootstrapResult`, the `ui-view:adopt` event; public in `lit-ui-router-ssr`           | M    | 2    |
| Lazy-state timing           | Time from the transition to the states registering, and the retry row                                             | `onStatesChanged` timestamps; public                                                  | S    | 2    |
| Search and jump             | Filter states; jump to one                                                                                        | As for the outline                                                                    | S–M  | 2    |
| Panel on the docs page      | The full panel beside an example, outside its 800px iframe                                                        | The transport                                                                         | M    | 3    |
| Verdict playground          | A URL's server verdict next to its client match                                                                   | `ServerRouter.resolve()`, `diagnoseMounts()`; server side                             | M    | 3    |
| Static state diagram        | Mermaid, SVG or JSON of the tree for READMEs and docs                                                             | The `states` payload from an exported session or the prerender step                   | M    | 4    |

Eight of these make the package clearly better than both the old visualizer and
`trace`: the reasons, redirect chains with options, session export with the test
recorder, the Performance track with the console reporter, the URL playground
with the config card, the param editor, the view tree, and the hydration report.
The last one only this repo can offer.

### Not recommended

| Idea                                                  | Why not                                                                                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Time travel                                           | Resolves, lazy loads and app side effects cannot rewind. Offer "run this transition again" instead                              |
| Per-hook timing; listening to `trace`                 | Hook calls are not observable, and `trace` is one object shared by every router in the realm. A core change, not a patch        |
| Resolve timing by wrapping `resolveFn`                | The adapter does it behind the opt-in `timeResolves` option, and it is monkey-patching. A core notification is the clean source |
| Replacing `defaultErrorHandler` to see errors         | It displaces the app's handler. `transition.promise` and `onInvalid` already carry the outcome                                  |
| Lazy-load chunk details                               | The router has no bundler data; only timing is honest                                                                           |
| A signals, effect or mobx graph                       | Those packages mirror `globals`; a graph adds nothing over the outline and the param diff                                       |
| Typed-registry inspection at runtime                  | `ui-router-registry` is types only                                                                                              |
| A diagram generator that imports app modules in Node  | DOM shims and registration order. Generate from a `states` snapshot                                                             |
| Server transitions embedded in every prerendered page | Bytes on production pages. Opt-in only, after the verdict summary                                                               |
| An accessibility pass or fail audit                   | Overlaps `tools/a11y`. An informational readout of focus and title after a transition is enough                                 |
| Dead-link linting                                     | Already tracked for the ESLint plugin (#1308)                                                                                   |

### What the adapter established

- **Invalid targets.** `go('typo')` creates no `Transition`; core runs the
  `onInvalid` callbacks and rejects. A public `onInvalid` callback that returns
  `undefined` observes it, and app handlers behave the same with it installed. If
  an app handler registered later rescues the target, the log still shows an
  invalid row, because callbacks run in registration order.
- **State detail without internals.** `stateService.target(name).$state()` is
  public and gives each param's type, `dynamic`, `squash`, `array` and `inherit`.
  `stateRegistry.matcher` is internal.
- **`options().source` is typed internal.** It is the only way to tell a URL
  change from a `go()` call, so the adapter reads it.
- **Location kind is inferred** from the registered location plugin's name; core
  has no public field for it.
- **Reporters verified.** In headless Chromium the demo sequence produces
  measures on the `Transitions`, `Phases` and `Resolves` tracks with the
  documented `detail.devtools` shape, and faults use the `error` colour.

## Where it plugs in

### Adopt first

| Integration              | Extension point                                                                                             | Reach                                                                                       | Cost |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---- |
| The element and adapter  | A custom element, a versioned event schema, and a `custom-elements.json` for editors and API viewers        | Every adapter                                                                               | —    |
| Performance track        | `performance.measure(name, { start, end, detail: { devtools: { track, trackGroup, color, properties } } })` | Custom tracks in Chrome and Edge; plain User Timing marks in Firefox Profiler and RUM tools | S    |
| Dev-only global hook     | `globalThis.__UI_ROUTER_DEVTOOLS_HOOK__` with the routers, a ring buffer and `snapshot()`                   | Coding agents, Playwright, Cypress, any later extension                                     | S    |
| Test recorder            | A `./testing` subpath over the hook and the adapter                                                         | Our e2e first, then anyone's                                                                | S    |
| Transport and docs panel | `postMessage` with a handshake and an origin check                                                          | Docs visitors; reused by every later host                                                   | M    |

The global hook is what serves coding agents today: `chrome-devtools-mcp`'s
`evaluate_script` can call `snapshot()` with no new API. The hook is installed
only in development and on opt-in, is read-only by default, and gates `go()`
behind a flag, because any script on the page can reach a global.

### Adopt later

| Integration           | Extension point                                                                                                                      | Note                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite DevTools dock    | A Vite plugin's `devtools.setup(ctx)` with `ctx.docks.register(...)`; `custom-render` mounts an element; RPC between Node and client | `@vitejs/devtools` 0.8. Nuxt DevTools and Vue DevTools 9 are moving onto it. Natural host: the `ui-router-server` Vite plugin, which can also bridge prerender data |
| TanStack Devtools     | A plugin `{ id, name, render(el) }`                                                                                                  | About ten lines; `@tanstack/devtools` 0.16; serves `@uirouter/react` apps                                                                                           |
| WebMCP tools          | `document.modelContext.registerTool(...)`                                                                                            | Chrome origin trial; a draft spec. Opt-in only, with `go` marked consequential                                                                                      |
| OpenTelemetry, Sentry | A span per transition; Sentry's `startBrowserTracingNavigationSpan` named by state                                                   | A docs recipe first, then a subpath with an optional peer                                                                                                           |
| Console formatters    | `window.devtoolsFormatters`                                                                                                          | Off by default in Chrome and Firefox, so low reach                                                                                                                  |
| Navigation API detail | A `navigationType` field on transition events from `navigation-location-plugin`                                                      | A field, not a surface                                                                                                                                              |

### Watch

- **Soft navigations.** Browser heuristics detect them; a router cannot declare
  one. Chrome's final origin trial ran in 147 to 149, and its ship status is
  unverified. Marks named by transition id are enough to correlate (#1836).
- **A Redux DevTools sink.** Each transition as an action gives a diff view for
  free. Its time travel would re-run resolves, so it is a recipe at most.
- **`console.createTask`** around hook invocation, for async stack traces. It
  needs core.
- **Storybook** addon panel.

### Skip

- **Our own browser extension:** store review and three browsers; it would only
  host the same element.
- **Vue, Angular and React DevTools:** Vue's API is moving to the Vite dock;
  Angular's Router Tree serves its own router and has no plugin API; React's has
  none (unverified).
- **Stately Inspector:** its diagrams need a machine definition, and a state
  tree does not declare its transitions.
- **Astro, Nuxt and SvelteKit hosts:** no UI-Router users.
- **IDE extensions.**

## What this means for the package

- **One package with subpaths.** Every layer shares the schema and the adapter.
  Host libraries are optional peers, so a subpath costs only its users.

  | Subpath                                      | Contents                                   | When   |
  | -------------------------------------------- | ------------------------------------------ | ------ |
  | `.`                                          | Adapter, recorder, schema types            | First  |
  | `./define`                                   | Registers the element                      | First  |
  | `./plugin`                                   | The `UIRouterPlugin`                       | First  |
  | `./performance`                              | Performance-panel and User Timing reporter | First  |
  | `./console`                                  | Console reporter                           | First  |
  | `./testing`                                  | Recorder helpers for e2e and unit tests    | First  |
  | `./transport`                                | `postMessage` bridge                       | Second |
  | `./vite`, `./tanstack`, `./otel`, `./webmcp` | Host integrations                          | Later  |

- **A no-op in production.** TanStack's devtools packages resolve to a no-op
  build unless the `development` export condition is set; the same shape fits
  here, beside a documented dynamic import behind a dev guard.
- **A versioned schema.** Each event carries a version, and each transport opens
  with a handshake naming the schema, the router and the adapter. Payloads stay
  structured-clone-safe so they pass through `postMessage`, RPC, agent tools and
  test attachments unchanged. A redaction option covers params that may hold
  secrets.
- **Naming.** Across the ecosystem "devtools" is the umbrella word (Vue, React,
  Angular, Redux, Vite, TanStack), "inspector" names narrower tools, and
  "visualizer" names static pictures. That supports `ui-router-devtools` for the
  package, `<ui-router-devtools>` for the element, and "Map" for the diagram tab.
- **Requests for core.** Resolve start and end notifications, or a listener on
  the trace emitters. One change improves the panel, the Performance track and
  the test recorder together.

## Revised stages

1. **First release.** Adapter with the two corrections, recorder, the panel as
   proposed with reasons, redirect options, config card and session export, plus
   the console and Performance reporters and the test helper. The five examples
   move over.
2. **Second.** URL playground, param editor, view tree, link inspector, resolve
   values, hydration report; the transport and the panel on the docs page; the
   global hook.
3. **Later.** Vite DevTools dock with server data, TanStack plugin, agent tools,
   observability recipes, a static diagram.

## References

| Topic                             | Link                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Chrome Performance extensibility  | <https://developer.chrome.com/docs/devtools/performance/extension>                               |
| Firefox Profiler markers          | <https://firefox-source-docs.mozilla.org/tools/profiler/instrumenting-javascript.html>           |
| Soft navigations                  | <https://developer.chrome.com/blog/final-soft-navigations-origin-trial>                          |
| Navigation API baseline           | <https://web.dev/blog/baseline-navigation-api>                                                   |
| Custom formatters                 | <https://firefox-source-docs.mozilla.org/devtools-user/custom_formatters/index.html>             |
| Vite DevTools                     | <https://devtools.vite.dev/guide/>, <https://devtools.vite.dev/kit/dock-system>                  |
| TanStack Devtools plugins         | <https://tanstack.com/devtools/v0/docs/plugin-lifecycle>                                         |
| WebMCP                            | <https://developer.chrome.com/docs/ai/webmcp/imperative-api>                                     |
| `chrome-devtools-mcp` tools       | <https://github.com/ChromeDevTools/chrome-devtools-mcp>                                          |
| Redux DevTools extension API      | <https://github.com/reduxjs/redux-devtools/blob/main/extension/docs/API/Methods.md>              |
| OpenTelemetry browser conventions | <https://opentelemetry.io/docs/specs/semconv/browser/browser-events/>                            |
| Sentry navigation spans           | <https://docs.sentry.io/platforms/javascript/tracing/instrumentation/automatic-instrumentation/> |
| Angular DevTools router tree      | <https://angular.dev/tools/devtools/router>                                                      |
| Stately Inspector                 | <https://stately.ai/docs/inspector>                                                              |

Unverified: the Chrome version floor for custom tracks; Safari's display of User
Timing; whether Playwright's trace viewer shows User Timing; the absence of a
React DevTools plugin API; Datadog's view-tracking call.
