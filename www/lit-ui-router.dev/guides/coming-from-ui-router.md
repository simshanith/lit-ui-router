---
title: Coming from UI-Router
description: Map @uirouter/angular and @uirouter/react concepts — views, links, resolves, lifecycle hooks, and lazy loading — directly to lit-ui-router
type: guide
topic: migration
---

# Coming from UI-Router

If you already know
[`@uirouter/angular`](https://ui-router.github.io/ng2/docs/latest/) or
[`@uirouter/react`](https://ui-router.github.io/react/docs/latest/), most of
your routing model transfers unchanged: `lit-ui-router` builds directly on the
same `@uirouter/core` engine. Only the view layer, template bindings, and
component integration change to fit Lit and custom elements.

The Angular column is `@uirouter/angular` (Angular 2 and later). The
`@uirouter/core` half of this page applies to `@uirouter/angularjs` as well;
its directives and setup are spelled differently.

## API equivalence

| Task                  | `@uirouter/angular`                                                                   | `@uirouter/react`                                                                     | `lit-ui-router`                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Router setup          | `provideUIRouter(config)` or `UIRouterModule.forRoot(...)`                            | `<UIRouter plugins={...} states={...}>` or `<UIRouter router={router}>`               | `new UIRouterLit()`, register plugins & states, `router.start()`, mount `<ui-router .uiRouter=${router}>`                                |
| Viewport              | `<ui-view>` / `<ui-view name="…">`                                                    | `<UIView />` / `<UIView name="…" />`                                                  | `<ui-view>` / `<ui-view name="…">` (light DOM)                                                                                           |
| Navigation link       | `uiSref="state"` `[uiParams]` `[uiOptions]`                                           | `<UISref to="state" params={...} options={...}>` or `useSref(...)`                    | `${uiSref('state', params, options)}` or `href=${srefHref('state', params, options)}`                                                    |
| Active link state     | `uiSrefActive="active"` / `uiSrefActiveEq="exact"`                                    | `<UISrefActive class="active" exact={...}>` or `useSrefActive` / `useSrefActiveExact` | `${uiSrefActive({ activeClasses, exactClasses })}`, `srefActiveClass` + `srefAriaCurrent`, or `SrefStatusController`                     |
| Reading resolves      | `@Input()` named for the resolve token, or remapped with the state's `bindings`       | One prop per resolve token, plus `transition`                                         | `uiViewProps?: UIViewInjectedProps<T>` on `LitElement`, or `` (props) => html`...` `` template parameter                                 |
| Exit guard            | `uiCanExit(trans)` on component class                                                 | `uiCanExit(trans)` on class components, or `useTransitionHook(...)`                   | `uiCanExit(trans)` on `LitElement` (`UiOnExit`)                                                                                          |
| Dynamic param updates | `uiOnParamsChanged(newParams, trans)` on component class                              | `useCurrentStateAndParams()` or `useOnStateChanged` / `useTransitionHook`             | `uiOnParamsChanged(newParams, trans)` on `LitElement` (`UiOnParamsChanged`)                                                              |
| Router outside views  | DI (`UIRouter`, `StateService`, `TransitionService`)                                  | `useRouter()`, `useCurrentStateAndParams()`, `useIsActive()`                          | `TransitionController`, `SrefStatusController`, `requestRouter` from `lit-ui-router/context` (or the Effect / MobX / Signals companions) |
| Lazy-loaded features  | `.**` future state with `loadChildren`, or `loadComponent` for a standalone component | `.**` future state with `lazyLoad`                                                    | `.**` future state with `lazyLoad` (or `import(...)` in a `resolve`)                                                                     |

The `@uirouter/angular` and `@uirouter/react` columns were read from each
adapter's source at 22.0.0 and 1.0.8; the `lit-ui-router` column is 1.20.

## What stays identical (`@uirouter/core`)

Everything owned by `@uirouter/core` works the same way with the same types:

- **State declarations**: `name`, `parent`, `url`, `params`, `data`, `resolve`,
  `resolvePolicy`, `redirectTo`, `lazyLoad` and `.**` future states. The keys
  of `views` (`name@state` targeting) are core too; each view's value is the
  adapter's own component type.
- **Services**: `router.stateRegistry`, `router.stateService`,
  `router.transitionService`, `router.urlService`, `router.globals`, and
  `router.trace`.
- **UI-Router plugins**: `@uirouter/sticky-states`, `@uirouter/dsr` (deep state
  redirect), and `@uirouter/visualizer` work directly on `UIRouterLit`.

## What differs in Lit

### 1. Pick a location plugin yourself

`UIRouterLit` installs no location plugin. Coming from `@uirouter/react`, pass
the same `hashLocationPlugin`, `pushStateLocationPlugin` or
`memoryLocationPlugin` to `router.plugin()`. Coming from `@uirouter/angular`,
this step is new: that adapter takes its URL handling from Angular's
`LocationStrategy` and the `useHash` option. See
[Location Plugins](./location-plugins), which also covers
[`ui-router-navigation-location-plugin`](/packages/ui-router-navigation-location-plugin)
for the Navigation API.

### 2. Resolves arrive on `uiViewProps`, not individual inputs

Unlike Angular's per-token `@Input()` bindings or React's spread props,
`<ui-view>` assigns one structured object —
[`UIViewInjectedProps<T>`](/reference/lit-ui-router/types/UIViewInjectedProps)
containing `router`, `transition`, and `resolves` — onto the routed
`LitElement`'s `uiViewProps` property:

```ts check
import { LitElement, html } from 'lit';
import { property } from 'lit/decorators.js';
import type { LitStateDeclaration, UIViewInjectedProps } from 'lit-ui-router';

interface ContactResolves {
  contact: { name: string };
}

export class ContactView extends LitElement {
  @property({ attribute: false })
  uiViewProps?: UIViewInjectedProps<ContactResolves>;

  override render() {
    return html`<h1>${this.uiViewProps?.resolves.contact.name}</h1>`;
  }
}

export const contactState = {
  name: 'contact',
  url: '/contacts/:id',
  resolve: [
    {
      token: 'contact',
      resolveFn: () => ({ name: 'Ada Lovelace' }),
    },
  ],
  component: ContactView,
} satisfies LitStateDeclaration<ContactResolves>;
```

For lightweight views that do not need a custom element class, pass a template
function `` (props) => html`...` `` instead. See
[Routed Components](./routed-components) for typing resolves and reaching
`routedElement`.

### 3. No framework DI container — router discovery uses DOM context

Mount `<ui-router .uiRouter=${router}>` near the root of your tree. Directives
(`uiSref`, `uiSrefActive`, `srefHref`, `srefActiveClass`, `srefAriaCurrent`),
`<ui-view>`, and controllers (`TransitionController`, `SrefStatusController`)
discover the router automatically via the web-components `context-request`
protocol, crossing shadow DOM boundaries without prop-drilling.

A resolve's `deps` can name other resolve tokens, `Transition` and `UIRouter`.
`@uirouter/angular` also lets `deps` name an Angular service; here no injector
stands behind the router, so that resolve fails with
`Could not find Dependency Injection token`. Import the service in the module
that declares the state, or supply it from a parent state's resolve.

For components that react to route changes outside `<ui-view>`, replace
Angular's injected `TransitionService` or React's `useCurrentStateAndParams()`
with [`TransitionController`](./reactive-components):

```ts check
import { LitElement, html } from 'lit';
import { TransitionController } from 'lit-ui-router';

export class CurrentRouteBanner extends LitElement {
  private readonly route = new TransitionController(this);

  override render() {
    return html`<p>Active state: ${this.route.current?.name || 'none'}</p>`;
  }
}
```

### 4. `<ui-view>` renders in light DOM

`<ui-view>` renders routed markup into its **light DOM** (not a shadow root),
so document styles and parent layouts flow through naturally while each routed
`LitElement` keeps its own shadow DOM encapsulation. Target the active routed
element with `ui-view > [routed]` or `view.routedElement` — see
[The routed element](./routed-components#the-routed-element).

### 5. Element-part vs attribute-part links, and `assignHref`

- `${uiSref('users')}` and `${uiSrefActive({ activeClasses: ['active'] })}` are
  element-part directives analogous to Angular's attribute directives. On link
  elements, `uiSrefActive` also manages `aria-current="page"` on exact match.
- For non-anchor elements (`<button>`, `<tr>`), pass `{ assignHref: 'auto' }` as
  `uiSref`'s third argument (`uiSref('users', {}, { assignHref: 'auto' })`) so
  `uiSref` does not write an inert `href`. For design-system link custom
  elements (`<sp-link>`, `<sl-*>`) that forward `href`, pass
  `{ assignHref: true }` or bind `href=${srefHref('users')}` directly — see
  [Design System Links](./design-system-links).
- For server rendering and static HTML linters, use the attribute-part
  directives `href=${srefHref(...)}`, `class=${srefActiveClass(...)}`, and
  `aria-current=${srefAriaCurrent(...)}` — see
  [Attribute-part forms](/packages/lit-ui-router#attribute-part-forms).

### 6. Reactive state ecosystems

`@uirouter/angular` installs the `@uirouter/rx` plugin, which adds `params$`,
`success$`, `start$` and `states$` to `router.globals`; `UIRouterLit` does not.
For reactive router state, optional companion packages bridge `@uirouter/core`
to [Effect](/packages/effect), [MobX](/packages/mobx), or
[TC39 Signals](/packages/signals), each shown in a live
[Sample App](/sample-app) variant.

## Further reading

- [Hello World tutorial](/tutorial/helloworld) — hands-on walkthrough in Lit
- [Routed Components](./routed-components) — `uiViewProps`, typed resolves,
  and `.**` lazy loading
- [Component Lifecycle Hooks](./component-lifecycle) — `uiCanExit` and
  `uiOnParamsChanged`
- [Reactive Components](./reactive-components) — `TransitionController` and
  `SrefStatusController`
- [UI-Router Guides](https://ui-router.github.io/guide/) — upstream
  `@uirouter/core` concepts
