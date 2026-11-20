---
title: Hello World
description: Getting started with lit-ui-router
type: tutorial
---

# Hello World

This tutorial will guide you through building your first lit-ui-router application. We'll create a simple app with two "pages" (`hello` and `about`), each with its own URL. You'll be able to click links to navigate between pages, and the active link will be highlighted.

## Live Demo

<LiveExample name="helloworld" />

## Start a project

This tutorial's app is the Hello World starter, a Vite + TypeScript project.
Copy it with [tiged](https://github.com/tiged/tiged), then run `npm install`
and `npm run dev` in `my-app`:

```bash
npx tiged simshanith/lit-ui-router/examples/helloworld my-app
```

The source is
[`examples/helloworld`](https://github.com/simshanith/lit-ui-router/tree/main/examples/helloworld)
on GitHub, and it runs in the browser on
[StackBlitz](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld?file=src%2Fmain.ts).
Its [`index.html`](https://github.com/simshanith/lit-ui-router/blob/main/examples/helloworld/index.html)
holds the `<div id="root">` host element the app renders into, and declares
`:root { color-scheme: light dark; }` so the page and the component's
`light-dark()` colours follow the system theme.

To add the router to an existing Vite project, install it with its peers:

```bash
npm install lit-ui-router lit @uirouter/core
```

The code below uses TypeScript decorators (`@customElement`). In `tsconfig.json`,
set `"experimentalDecorators": true` and `"useDefineForClassFields": false` —
Vite's `lit-ts` template already sets both (see
[Getting started](../introduction#add-to-an-existing-project)).

## Full Source Code

Here's the complete source code for this tutorial. Don't worry if it looks overwhelming - we'll break it down step by step below.

```typescript check
import { html, LitElement, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  type LitStateDeclaration,
} from 'lit-ui-router';

@customElement('app-root')
class AppRoot extends LitElement {
  static styles = css`
    nav a {
      padding: 8px 16px;
      text-decoration: none;
      color: inherit;
      border-radius: 4px;
    }
    @media (hover: hover) and (pointer: fine) {
      nav a:hover {
        background: light-dark(#f0f0f0, #2c2c2c);
      }
    }
    nav a[aria-current='page'] {
      background: light-dark(#1f1f1f, #ededed);
      color: light-dark(#fff, #111);
    }
  `;

  render() {
    return html`
      <nav aria-label="Hello World">
        <a ${uiSrefActive({})} ${uiSref('hello')}>Hello</a>
        <a ${uiSrefActive({})} ${uiSref('about')}>About</a>
      </nav>
      <ui-view></ui-view>
    `;
  }
}

// State definitions
const helloState: LitStateDeclaration = {
  name: 'hello',
  url: '/hello',
  component: () => html`<h3>Hello World!</h3>`,
};

const aboutState: LitStateDeclaration = {
  name: 'about',
  url: '/about',
  component: () =>
    html`<h3>About</h3>
      <p>This is a simple lit-ui-router application.</p>`,
};

// Router setup
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
router.trace.enable('TRANSITION');
router.stateRegistry.register(helloState);
router.stateRegistry.register(aboutState);
router.urlService.rules.initial({ state: 'hello' });
router.start();

// Render
render(
  html`
    <ui-router .uiRouter=${router}>
      <app-root></app-root>
    </ui-router>
  `,
  document.getElementById('root')!,
);
```

---

## Building Hello World

Let's break down the code step by step.

### ES Module Imports

```typescript check
import { html, LitElement, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  type LitStateDeclaration,
} from 'lit-ui-router';
```

We import the essential dependencies:

- **Lit**: `html`, `LitElement`, `css`, `render`, and `customElement` for building web components
- **@uirouter/core**: `hashLocationPlugin` for hash-based URL routing (e.g., `/#/hello`)
- **lit-ui-router**: The router class and directives

### Creating Components

Each "page" in our application is a simple function that returns a Lit html template:

```typescript
() => html`<h3>Hello World!</h3>`;

() =>
  html`<h3>About</h3>
    <p>This is a simple lit-ui-router application.</p>`;
```

These are standard Lit templates. When navigation occurs, lit-ui-router will render the appropriate component based on the current state.

### State Definitions

States are the fundamental building blocks of UI-Router. Each state defines a URL and the component to render:

```typescript
const helloState: LitStateDeclaration = {
  name: 'hello',
  url: '/hello',
  component: () => html`<h3>Hello World!</h3>`,
};

const aboutState: LitStateDeclaration = {
  name: 'about',
  url: '/about',
  component: () =>
    html`<h3>About</h3>
      <p>This is a simple lit-ui-router application.</p>`,
};
```

- **name**: A unique identifier for the state
- **url**: The URL path that activates this state
- **component**: The Lit component to render when this state is active

### Navigation with uiSref

The `uiSref` directive creates navigational links to states:

```typescript
@customElement('app-root')
class AppRoot extends LitElement {
  render() {
    return html`
      <nav aria-label="Hello World">
        <a ${uiSrefActive({})} ${uiSref('hello')}>Hello</a>
        <a ${uiSrefActive({})} ${uiSref('about')}>About</a>
      </nav>
      <ui-view></ui-view>
    `;
  }
}
```

- **`uiSref('hello')`**: Creates a link to the `hello` state. The directive sets the `href` attribute and handles click events.
- **`uiSrefActive({})`**: Sets `aria-current="page"` on the link while its state is active. Screen readers announce it as the current page, and the `nav a[aria-current='page']` rule draws the highlight from the same attribute, so the look cannot drift from what assistive technology reports. Pass `activeClasses` to add CSS classes as well.
- **`<ui-view>`**: The viewport where routed components are rendered.

::: tip What is `sref`?
`sref` stands for "State Reference" - it's similar to an `href` but references a state by name instead of a URL path.
:::

### Router Configuration

Configure and start the router:

```typescript
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
router.trace.enable('TRANSITION');
router.stateRegistry.register(helloState);
router.stateRegistry.register(aboutState);
router.urlService.rules.initial({ state: 'hello' });
router.start();
```

1. **Create router**: Instantiate `UIRouterLit`
2. **Add plugins**: `hashLocationPlugin` enables hash-based URLs (`/#/hello`)
3. **Trace transitions**: `router.trace.enable('TRANSITION')` logs each transition to the browser console, a cheap way to watch the router work
4. **Register states**: Add each state to the registry
5. **Set initial state**: Define where to navigate when the app loads with no URL
6. **Start**: Begin listening for URL changes and processing state transitions

### Bootstrap

Finally, render the application:

```typescript
render(
  html`
    <ui-router .uiRouter=${router}>
      <app-root></app-root>
    </ui-router>
  `,
  document.getElementById('root')!,
);
```

- **`<ui-router>`**: The root element that provides the router context to all descendants
- **`.uiRouter=${router}`**: Pass the configured router instance
- **`<app-root>`**: Your main application component containing navigation and `<ui-view>`

---

## Next Steps

Now that you understand the basics, continue to [Hello Solar System](./hellosolarsystem) to learn about:

- Fetching data with **resolves**
- Using **state parameters** in URLs
- Passing parameters when navigating
