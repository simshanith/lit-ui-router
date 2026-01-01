---
title: Hello Solar System
description: Learn about resolves and state parameters
---

# Hello Solar System

Building on [Hello World](./helloworld), this tutorial introduces data fetching with **resolves** and **state parameters**. We'll build a list/detail interface showing planets in our solar system.

## Live Demo

<iframe src="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem?embed=1&file=src/main.ts&view=preview" style="width:100%; height:400px; border:0; border-radius: 4px; overflow:hidden;" title="lit-ui-router-hellosolarsystem" sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"></iframe>

<a href="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem?file=src/main.ts" target="_blank">Open in new tab</a>

## What We're Building

- A `people` state showing a list of planets
- A `person` state showing details of a selected planet
- Data is fetched **before** the state is activated using resolves
- The URL includes a parameter for the selected planet: `/people/3`

---

## Resolve Data

### What is a Resolve?

A **resolve** fetches data before a state is entered. The state's component only renders after all resolves have completed. This ensures your component always has the data it needs.

### The People Service

First, we create a simple data service:

```typescript
// services/people.ts
export interface Person {
  id: number;
  name: string;
  description: string;
}

const people: Person[] = [
  { id: 1, name: 'Sun', description: 'The star at the center of our solar system.' },
  { id: 2, name: 'Mercury', description: 'The smallest planet and closest to the Sun.' },
  { id: 3, name: 'Venus', description: 'The hottest planet with a thick atmosphere.' },
  { id: 4, name: 'Earth', description: 'Our home planet, the only known planet with life.' },
  { id: 5, name: 'Mars', description: 'The red planet, a target for future exploration.' },
];

export const PeopleService = {
  getAllPeople: (): Promise<Person[]> => {
    return Promise.resolve(people);
  },
  getPerson: (id: number): Promise<Person | undefined> => {
    return Promise.resolve(people.find((p) => p.id === id));
  },
};
```

### Adding Resolves to States

```typescript
const peopleState: LitStateDeclaration = {
  name: 'people',
  url: '/people',
  component: PeopleListComponent,
  resolve: [
    {
      token: 'people',
      resolveFn: () => PeopleService.getAllPeople(),
    },
  ],
};
```

The resolve block:

- **token**: A string identifier for the resolved data
- **resolveFn**: An async function that returns data (or a Promise)

When navigating to `people`, the router:

1. Calls `PeopleService.getAllPeople()`
2. Waits for the Promise to resolve
3. Renders `PeopleListComponent` with the data available

### Accessing Resolved Data

Components receive resolved data through `_uiViewProps`:

```typescript
import { UIViewInjectedProps } from 'lit-ui-router';

@customElement('people-list')
class PeopleListComponent extends LitElement {
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  get people(): Person[] {
    return this._uiViewProps.resolves.people;
  }

  render() {
    return html`
      <h3>Solar System</h3>
      <ul>
        ${this.people.map(
          (person) => html`
            <li>
              <a ${uiSref('person', { personId: person.id })}>${person.name}</a>
            </li>
          `,
        )}
      </ul>
    `;
  }
}
```

Key points:

- **`_uiViewProps`**: Injected by `<ui-view>`, contains `resolves`, `router`, and `transition`
- **Constructor parameter**: The props are passed to the constructor when the component is created
- **`resolves.people`**: Access data using the resolve's token name

---

## State Parameters

### Defining Parameters

The `person` state needs to know which person to display. We define a URL parameter:

```typescript
const personState: LitStateDeclaration = {
  name: 'person',
  url: '/people/:personId',
  component: PersonDetailComponent,
  resolve: [
    {
      token: 'person',
      deps: ['$transition$'],
      resolveFn: ($transition$) => {
        const personId = parseInt($transition$.params().personId);
        return PeopleService.getPerson(personId);
      },
    },
  ],
};
```

- **`:personId`**: Defines a URL parameter. For `/people/3`, `personId` would be `"3"`
- **`deps: ['$transition$']`**: Inject the current transition object
- **`$transition$.params()`**: Access all state parameters

### Linking with Parameters

Pass parameters when creating state links:

```typescript
html`<a ${uiSref('person', { personId: person.id })}>${person.name}</a>`;
```

The second argument to `uiSref` is a parameters object. This generates a URL like `/people/3`.

### The Person Detail Component

```typescript
@customElement('person-detail')
class PersonDetailComponent extends LitElement {
  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  get person(): Person | undefined {
    return this._uiViewProps.resolves.person;
  }

  render() {
    if (!this.person) {
      return html`<p>Person not found</p>`;
    }
    return html`
      <div>
        <h3>${this.person.name}</h3>
        <p>${this.person.description}</p>
        <a ${uiSref('people')}>Back to list</a>
      </div>
    `;
  }
}
```

---

## Full Source Code

```typescript
import { html, LitElement, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit, uiSref, uiSrefActive, LitStateDeclaration, UIViewInjectedProps } from 'lit-ui-router';

// Data Service
interface Person {
  id: number;
  name: string;
  description: string;
}

const people: Person[] = [
  { id: 1, name: 'Sun', description: 'The star at the center of our solar system.' },
  { id: 2, name: 'Mercury', description: 'The smallest planet and closest to the Sun.' },
  { id: 3, name: 'Venus', description: 'The hottest planet with a thick atmosphere.' },
  { id: 4, name: 'Earth', description: 'Our home planet, the only known planet with life.' },
  { id: 5, name: 'Mars', description: 'The red planet, a target for future exploration.' },
];

const PeopleService = {
  getAllPeople: (): Promise<Person[]> => Promise.resolve(people),
  getPerson: (id: number): Promise<Person | undefined> => Promise.resolve(people.find((p) => p.id === id)),
};

// Components
@customElement('people-list')
class PeopleListComponent extends LitElement {
  static styles = css`
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      margin: 8px 0;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  `;

  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  get people(): Person[] {
    return this._uiViewProps.resolves.people;
  }

  render() {
    return html`
      <h3>Solar System</h3>
      <ul>
        ${this.people.map(
          (person) => html`
            <li>
              <a ${uiSref('person', { personId: person.id })}>${person.name}</a>
            </li>
          `,
        )}
      </ul>
    `;
  }
}

@customElement('person-detail')
class PersonDetailComponent extends LitElement {
  static styles = css`
    .back-link {
      margin-top: 16px;
      display: block;
    }
  `;

  @property({ attribute: false })
  _uiViewProps!: UIViewInjectedProps;

  constructor(props: UIViewInjectedProps) {
    super();
    this._uiViewProps = props;
  }

  get person(): Person | undefined {
    return this._uiViewProps.resolves.person;
  }

  render() {
    if (!this.person) {
      return html`<p>Person not found</p>`;
    }
    return html`
      <div>
        <h3>${this.person.name}</h3>
        <p>${this.person.description}</p>
        <a class="back-link" ${uiSref('people')}>Back to list</a>
      </div>
    `;
  }
}

@customElement('app-root')
class AppRoot extends LitElement {
  static styles = css`
    nav {
      margin-bottom: 16px;
    }
    nav a {
      margin-right: 16px;
      color: #333;
    }
    nav a.active {
      font-weight: bold;
    }
  `;

  render() {
    return html`
      <h2>Hello Solar System</h2>
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('people')}>People</a>
      </nav>
      <ui-view></ui-view>
    `;
  }
}

// State definitions
const peopleState: LitStateDeclaration = {
  name: 'people',
  url: '/people',
  component: PeopleListComponent,
  resolve: [
    {
      token: 'people',
      resolveFn: () => PeopleService.getAllPeople(),
    },
  ],
};

const personState: LitStateDeclaration = {
  name: 'person',
  url: '/people/:personId',
  component: PersonDetailComponent,
  resolve: [
    {
      token: 'person',
      deps: ['$transition$'],
      resolveFn: ($transition$: any) => {
        const personId = parseInt($transition$.params().personId);
        return PeopleService.getPerson(personId);
      },
    },
  ],
};

// Router setup
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
router.stateRegistry.register(peopleState);
router.stateRegistry.register(personState);
router.urlService.rules.initial({ state: 'people' });
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

## URL Persistence

Notice that the URL contains all the state information:

- `/#/people` - The people list
- `/#/people/3` - Venus details

You can bookmark these URLs or refresh the page, and the application will restore to the same state. This is one of the key benefits of state-based routing.

---

## Next Steps

Continue to [Hello Galaxy](./hellogalaxy) to learn about:

- **Nested states** with parent-child relationships
- **Nested ui-views** for complex layouts
- **Relative state references** for navigation within a state hierarchy
