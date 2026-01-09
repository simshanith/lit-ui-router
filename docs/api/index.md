# API Guide

This page provides a guide to the public API of `lit-ui-router` with usage examples.

::: tip API Reference
For detailed type signatures and auto-generated documentation, see the [API Reference](./reference/).
:::

## Installation

```bash
npm install lit-ui-router
# or
yarn add lit-ui-router
# or
pnpm add lit-ui-router
```

## Imports

```ts
import {
  // Core
  UIRouterLit,

  // Components
  // <ui-router> and <ui-view> are auto-registered custom elements

  // Directives
  uiSref,
  uiSrefActive,

  // Types
  LitStateDeclaration,
  UIViewInjectedProps,
} from 'lit-ui-router';
```

## UIRouterLit

The main router class that extends `@uirouter/core`'s `UIRouter`.

```ts
import { UIRouterLit } from 'lit-ui-router';
import { hashLocationPlugin } from '@uirouter/core';

const router = new UIRouterLit();

// Add location plugin (required)
router.plugin(hashLocationPlugin);

// Register states
router.stateRegistry.register({
  name: 'home',
  url: '/home',
  component: HomeComponent,
});

// Set initial state (optional)
router.urlService.rules.initial({ state: 'home' });

// Start the router
router.start();
```

### Methods

| Method           | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| `plugin(plugin)` | Register a plugin (e.g., `hashLocationPlugin`, `pushStateLocationPlugin`) |
| `start()`        | Start listening for URL changes and sync the initial state                |
| `stateRegistry`  | Access to state registration and lookup                                   |
| `stateService`   | Access to state transitions (`go`, `href`, etc.)                          |
| `urlService`     | Access to URL configuration                                               |

## Components

### `<ui-router>`

The root component that provides the router context to descendants.

```html
<ui-router .uiRouter="${router}">
  <app-root></app-root>
</ui-router>
```

#### Properties

| Property   | Type          | Description                                                      |
| ---------- | ------------- | ---------------------------------------------------------------- |
| `uiRouter` | `UIRouterLit` | The router instance. If not provided, creates one automatically. |

### `<ui-view>`

A viewport that renders the component for the current state.

```html
<ui-view></ui-view>

<!-- Named view -->
<ui-view name="sidebar"></ui-view>
```

#### Properties

| Property   | Type          | Description                                                                 |
| ---------- | ------------- | --------------------------------------------------------------------------- |
| `name`     | `string`      | The view name. Defaults to `$default`.                                      |
| `uiRouter` | `UIRouterLit` | Optional direct router reference (inherited from `<ui-router>` if not set). |

#### Default Content

`<ui-view>` can have default content that renders when no state is active:

```html
<ui-view>
  <p>Loading...</p>
</ui-view>
```

## Directives

### `uiSref`

Creates a link to a state. Use as a Lit directive on anchor elements.

```ts
import { uiSref } from 'lit-ui-router';

html`<a ${uiSref('home')}>Home</a>`;

// With parameters
html`<a ${uiSref('user', { userId: 123 })}>User Profile</a>`;

// With options
html`<a ${uiSref('home', {}, { reload: true })}>Home (reload)</a>`;
```

#### Parameters

| Parameter | Type                | Description                                          |
| --------- | ------------------- | ---------------------------------------------------- |
| `state`   | `string`            | Target state name. Use `.child` for relative states. |
| `params`  | `object`            | Optional state parameters.                           |
| `options` | `TransitionOptions` | Optional transition options.                         |

### `uiSrefActive`

Adds CSS classes when the linked state is active.

```ts
import { uiSref, uiSrefActive } from 'lit-ui-router';

html` <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('home')}>Home</a> `;

// With exact matching
html`
  <a
    ${uiSrefActive({
      activeClasses: ['active'],
      exactClasses: ['exact'],
    })}
    ${uiSref('home')}
    >Home</a
  >
`;
```

#### Options

| Option          | Type       | Description                                      |
| --------------- | ---------- | ------------------------------------------------ |
| `activeClasses` | `string[]` | Classes added when state or any child is active. |
| `exactClasses`  | `string[]` | Classes added only when exact state is active.   |

## State Declaration

### LitStateDeclaration

Defines a state with its URL, component, and optional configuration.

```ts
import { LitStateDeclaration } from 'lit-ui-router';

const homeState: LitStateDeclaration = {
  name: 'home',
  url: '/home',
  component: HomeComponent,
};
```

#### Properties

| Property     | Type                     | Description                                                             |
| ------------ | ------------------------ | ----------------------------------------------------------------------- |
| `name`       | `string`                 | Unique state name. Use dot notation for nesting (e.g., `parent.child`). |
| `url`        | `string`                 | URL pattern. Supports parameters (`:id`) and query params (`?sort`).    |
| `component`  | `LitElement \| Function` | The component to render. Can be a class or template function.           |
| `resolve`    | `Resolvable[]`           | Data to fetch before the state activates.                               |
| `params`     | `object`                 | Default parameter values and configuration.                             |
| `redirectTo` | `string`                 | Redirect to another state.                                              |
| `onEnter`    | `Function`               | Hook called when entering the state.                                    |
| `onExit`     | `Function`               | Hook called when exiting the state.                                     |

### Nested States

Create parent-child relationships using dot notation:

```ts
const peopleState: LitStateDeclaration = {
  name: 'people',
  url: '/people',
  component: PeopleListComponent,
};

const personState: LitStateDeclaration = {
  name: 'people.person', // Child of 'people'
  url: '/:personId', // Appends to parent URL: /people/:personId
  component: PersonDetailComponent,
};
```

### Resolve

Fetch data before a state activates:

```ts
const personState: LitStateDeclaration = {
  name: 'person',
  url: '/person/:personId',
  component: PersonComponent,
  resolve: [
    {
      token: 'person',
      deps: ['$transition$'],
      resolveFn: async ($transition$) => {
        const id = $transition$.params().personId;
        return await fetchPerson(id);
      },
    },
  ],
};
```

## Component Props

### UIViewInjectedProps

Props injected into routed components.

```ts
import { LitElement } from 'lit';
import { UIViewInjectedProps } from 'lit-ui-router';

class MyComponent extends LitElement {
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  get person() {
    return this._uiViewProps.resolves.person;
  }
}
```

#### Properties

| Property     | Type         | Description                                   |
| ------------ | ------------ | --------------------------------------------- |
| `router`     | `UIRouter`   | The router instance.                          |
| `resolves`   | `object`     | Resolved data keyed by token name.            |
| `transition` | `Transition` | The transition that activated this component. |

## Component Lifecycle Hooks

### uiCanExit

Called before the component's state is exited. Return `false` or a rejected promise to cancel the transition.

```ts
class MyComponent extends LitElement {
  uiCanExit(transition: Transition): boolean | Promise<boolean> {
    if (this.hasUnsavedChanges) {
      return confirm('Discard unsaved changes?');
    }
    return true;
  }
}
```

### uiOnParamsChanged

Called when route parameters change without destroying the component.

```ts
class MyComponent extends LitElement {
  uiOnParamsChanged(newParams: object, transition: Transition) {
    console.log('Params changed:', newParams);
    this.loadData(newParams);
  }
}
```

## Location Plugins

Import from `@uirouter/core`:

```ts
import { hashLocationPlugin, pushStateLocationPlugin } from '@uirouter/core';

// Hash-based URLs: /#/home
router.plugin(hashLocationPlugin);

// HTML5 pushState URLs: /home
router.plugin(pushStateLocationPlugin);
```
