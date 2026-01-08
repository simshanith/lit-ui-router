---
title: Hello World
description: Getting started with lit-ui-router
---

# Hello World

This tutorial will guide you through building your first lit-ui-router application. We'll create a simple app with two "pages" (`hello` and `about`), each with its own URL. You'll be able to click links to navigate between pages, and the active link will be highlighted.

## Live Demo

<StackBlitzEmbed
src="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld?embed=1&file=src/main.ts&view=preview"
title="lit-ui-router-helloworld"><a href="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld?file=src/main.ts" target="_blank"><img alt="Open in StackBlitz" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" /></a></StackBlitzEmbed>

## Full Source Code

Here's the complete source code for this tutorial. Don't worry if it looks overwhelming - we'll break it down step by step below.

```typescript
import { html, LitElement, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit, uiSref, uiSrefActive, LitStateDeclaration } from 'lit-ui-router';

// Components
@customElement('hello-component')
class HelloComponent extends LitElement {
  render() {
    return html`<h3>Hello World!</h3>`;
  }
}

@customElement('about-component')
class AboutComponent extends LitElement {
  render() {
    return html`
      <h3>About</h3>
      <p>This is a simple lit-ui-router application.</p>
    `;
  }
}

@customElement('app-root')
class AppRoot extends LitElement {
  static styles = css`
    nav a {
      padding: 8px 16px;
      text-decoration: none;
      color: #333;
    }
    nav a.active {
      font-weight: bold;
      background: #e0e0e0;
      border-radius: 4px;
    }
  `;

  render() {
    return html`
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('hello')}>Hello</a>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('about')}>About</a>
      </nav>
      <ui-view></ui-view>
    `;
  }
}

// State definitions
const helloState: LitStateDeclaration = {
  name: 'hello',
  url: '/hello',
  component: HelloComponent,
};

const aboutState: LitStateDeclaration = {
  name: 'about',
  url: '/about',
  component: AboutComponent,
};

// Router setup
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
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

```typescript
import { html, LitElement, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit, uiSref, uiSrefActive, LitStateDeclaration } from 'lit-ui-router';
```

We import the essential dependencies:

- **Lit**: `html`, `LitElement`, `css`, `render`, and `customElement` for building web components
- **@uirouter/core**: `hashLocationPlugin` for hash-based URL routing (e.g., `/#/hello`)
- **lit-ui-router**: The router class and directives

### Creating Components

Each "page" in our application is a Lit web component:

```typescript
@customElement('hello-component')
class HelloComponent extends LitElement {
  render() {
    return html`<h3>Hello World!</h3>`;
  }
}

@customElement('about-component')
class AboutComponent extends LitElement {
  render() {
    return html`
      <h3>About</h3>
      <p>This is a simple lit-ui-router application.</p>
    `;
  }
}
```

These are standard LitElement components. When navigation occurs, lit-ui-router will render the appropriate component based on the current state.

### State Definitions

States are the fundamental building blocks of UI Router. Each state defines a URL and the component to render:

```typescript
const helloState: LitStateDeclaration = {
  name: 'hello',
  url: '/hello',
  component: HelloComponent,
};

const aboutState: LitStateDeclaration = {
  name: 'about',
  url: '/about',
  component: AboutComponent,
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
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('hello')}>Hello</a>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('about')}>About</a>
      </nav>
      <ui-view></ui-view>
    `;
  }
}
```

- **`uiSref('hello')`**: Creates a link to the `hello` state. The directive sets the `href` attribute and handles click events.
- **`uiSrefActive({ activeClasses: ['active'] })`**: Adds the `active` class when the linked state is currently active.
- **`<ui-view>`**: The viewport where routed components are rendered.

::: tip What is `sref`?
`sref` stands for "State Reference" - it's similar to an `href` but references a state by name instead of a URL path.
:::

### Router Configuration

Configure and start the router:

```typescript
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
router.stateRegistry.register(helloState);
router.stateRegistry.register(aboutState);
router.urlService.rules.initial({ state: 'hello' });
router.start();
```

1. **Create router**: Instantiate `UIRouterLit`
2. **Add plugins**: `hashLocationPlugin` enables hash-based URLs (`/#/hello`)
3. **Register states**: Add each state to the registry
4. **Set initial state**: Define where to navigate when the app loads with no URL
5. **Start**: Begin listening for URL changes and processing state transitions

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
