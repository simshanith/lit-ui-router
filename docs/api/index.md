# API Overview

This guide provides a quick overview of the `lit-ui-router` API. For detailed type signatures and complete documentation, see the [API Reference](./reference/).

## Installation

```bash
npm install lit-ui-router
# or
pnpm add lit-ui-router
```

## Quick Start

```ts
import { UIRouterLit, uiSref, uiSrefActive, LitStateDeclaration } from 'lit-ui-router';
import { hashLocationPlugin } from '@uirouter/core';
import { html } from 'lit';

// 1. Create router and add location plugin
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);

// 2. Define states
const states: LitStateDeclaration[] = [
  { name: 'home', url: '/home', component: () => html`<h1>Home</h1>` },
  { name: 'users', url: '/users', component: UserListElement },
];

// 3. Register states and start
states.forEach((state) => router.stateRegistry.register(state));
router.urlService.rules.initial({ state: 'home' });
router.start();
```

```html
<!-- 4. Use in your app -->
<ui-router .uiRouter="${router}">
  <nav>
    <a ${uiSref('home')} ${uiSrefActive({ activeClasses: ['active'] })}>Home</a>
    <a ${uiSref('users')} ${uiSrefActive({ activeClasses: ['active'] })}>Users</a>
  </nav>
  <ui-view></ui-view>
</ui-router>
```

## Core Concepts

### Router

[`UIRouterLit`](./reference/core/UIRouterLit) is the main router class. It extends `@uirouter/core`'s UIRouter with Lit-specific view handling.

### Components

- [**`<ui-router>`**](./reference/components/UIRouterLitElement) - Root component that provides router context to descendants
- [**`<ui-view>`**](./reference/components/UiView) - Viewport that renders the component for the current state

### Directives

- **[`uiSref`](./reference/directives/uiSref)** - Creates navigation links to states
- **[`uiSrefActive`](./reference/directives/uiSrefActive)** - Adds CSS classes when linked state is active

### State Declaration

[`LitStateDeclaration`](./reference/types/LitStateDeclaration) defines a state with its URL and component.

#### Component Styles

lit-ui-router supports multiple ways to define route components:

**Inline Template Function** (simplest)

```ts
{ name: 'home', url: '/', component: () => html`<h1>Home</h1>` }
```

**Template with Route Parameters**

```ts
{
  name: 'user',
  url: '/user/:id',
  component: (props) => html`<h1>User ${props?.transition?.params().id}</h1>`
}
```

**Template with Resolved Data**

```ts
{
  name: 'users',
  url: '/users',
  component: (props) => html`
    <ul>${props?.resolves?.users?.map(u => html`<li>${u.name}</li>`)}</ul>
  `,
  resolve: [{ token: 'users', resolveFn: () => fetchUsers() }]
}
```

**LitElement Class** (for complex components with lifecycle/state)

```ts
{ name: 'dashboard', url: '/dashboard', component: DashboardElement }
```

| Style                    | Best For                                       |
| ------------------------ | ---------------------------------------------- |
| `() => html\`...\``      | Simple static views                            |
| `(props) => html\`...\`` | Views needing params or resolves               |
| `MyElement`              | Complex views with lifecycle, state, or styles |

### Lifecycle Hooks

Components can implement these interfaces to respond to routing events:

- **[`UiOnExit`](./reference/hooks/UiOnExit)** - Called before navigating away (can cancel navigation)
- **[`UiOnParamsChanged`](./reference/hooks/UiOnParamsChanged)** - Called when route parameters change

### Injected Props

Routed components receive [`UIViewInjectedProps`](./reference/types/UIViewInjectedProps) with:

- `router` - The UIRouter instance
- `transition` - The current transition
- `resolves` - Resolved data from state declarations

## Location Plugins

Import from `@uirouter/core`:

```ts
import { hashLocationPlugin, pushStateLocationPlugin } from '@uirouter/core';

// Hash URLs: /#/home
router.plugin(hashLocationPlugin);

// HTML5 pushState: /home
router.plugin(pushStateLocationPlugin);
```

See the [@uirouter/core location plugins documentation](https://ui-router.github.io/core/docs/latest/):

- [PushStateLocationService](https://ui-router.github.io/core/docs/latest/classes/_vanilla_pushstatelocationservice_.pushstatelocationservice.html) - HTML5 history API
- [HashLocationService](https://ui-router.github.io/core/docs/latest/classes/_vanilla_hashlocationservice_.hashlocationservice.html) - Hash-based URLs

## Further Reading

- [Tutorial](/tutorial/helloworld) - Step-by-step guide
- [API Reference](./reference/) - Complete type documentation
- [@uirouter/core docs](https://ui-router.github.io/core/docs/latest/) - Core router documentation
