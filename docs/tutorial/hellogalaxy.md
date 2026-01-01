---
title: Hello Galaxy
description: Learn about nested states and views
---

# Hello Galaxy

Building on [Hello Solar System](./hellosolarsystem), this tutorial introduces **nested states** and **nested ui-views**. We'll refactor our app so the list and detail views appear side-by-side, with the list always visible.

## Live Demo

<a href="https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy?file=src/main.ts" target="_blank">Open in StackBlitz</a>

## What We're Building

Instead of navigating between separate list and detail pages, we'll create a layout where:
- The list of planets is always visible on the left
- The selected planet's details appear on the right
- Child states are rendered in a nested `<ui-view>`

---

## Nested States

### Parent-Child Relationships

In UI Router, states can have parent-child relationships defined using dot notation:

```typescript
// Parent state
const peopleState: LitStateDeclaration = {
  name: 'people',
  url: '/people',
  component: PeopleContainerComponent,
  resolve: [
    { token: 'people', resolveFn: () => PeopleService.getAllPeople() },
  ],
};

// Child state (note the dot notation: people.person)
const personState: LitStateDeclaration = {
  name: 'people.person',
  url: '/:personId',
  component: PersonDetailComponent,
  resolve: [
    {
      token: 'person',
      deps: ['$transition$', 'people'],
      resolveFn: ($transition$, people) => {
        const personId = parseInt($transition$.params().personId);
        return people.find((p: Person) => p.id === personId);
      },
    },
  ],
};
```

Key concepts:

1. **Dot notation**: `people.person` means "person is a child of people"
2. **URL composition**: The child's URL appends to the parent's URL
   - Parent: `/people`
   - Child: `/:personId`
   - Combined: `/people/:personId`
3. **Resolve inheritance**: Child states can access parent resolves via `deps`

### Nested ui-view

The parent component includes a `<ui-view>` where child components render:

```typescript
@customElement('people-container')
class PeopleContainerComponent extends LitElement {
  static styles = css`
    .container { display: flex; gap: 32px; }
    .list { flex: 0 0 200px; }
    .detail { flex: 1; }
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
      <div class="container">
        <div class="list">
          <h3>Solar System</h3>
          <ul>
            ${this.people.map(person => html`
              <li>
                <a
                  ${uiSrefActive({ activeClasses: ['active'] })}
                  ${uiSref('.person', { personId: person.id })}
                >${person.name}</a>
              </li>
            `)}
          </ul>
        </div>
        <div class="detail">
          <!-- Child state renders here -->
          <ui-view>
            <p>Select an item from the list</p>
          </ui-view>
        </div>
      </div>
    `;
  }
}
```

The nested `<ui-view>`:
- Renders the child state's component (`PersonDetailComponent`)
- Shows default content ("Select an item...") when no child state is active
- Only child states of `people` will render here

---

## Relative State References

### Using `.` for Relative Navigation

When navigating within a state hierarchy, use relative references:

```typescript
// From within the 'people' state:
${uiSref('.person', { personId: person.id })}

// This is equivalent to:
${uiSref('people.person', { personId: person.id })}
```

The `.` means "relative to the current state's context." This is useful because:
- It's shorter to write
- If you rename the parent state, child references still work
- It makes the relationship clearer

### Going Up the Hierarchy

You can also navigate up:

```typescript
// From 'people.person', go back to parent
${uiSref('^')}  // Goes to 'people'

// Or use absolute reference
${uiSref('people')}
```

---

## Resolve Inheritance

Child states can depend on parent resolves:

```typescript
const personState: LitStateDeclaration = {
  name: 'people.person',
  url: '/:personId',
  component: PersonDetailComponent,
  resolve: [
    {
      token: 'person',
      deps: ['$transition$', 'people'],  // 'people' comes from parent!
      resolveFn: ($transition$, people) => {
        const personId = parseInt($transition$.params().personId);
        return people.find((p: Person) => p.id === personId);
      },
    },
  ],
};
```

This is powerful because:
- The parent's data is already loaded
- No need to fetch the entire list again
- Child resolve can filter or transform parent data

---

## Full Source Code

```typescript
import { html, LitElement, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  LitStateDeclaration,
  UIViewInjectedProps
} from 'lit-ui-router';

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
};

// Components
@customElement('people-container')
class PeopleContainerComponent extends LitElement {
  static styles = css`
    .container { display: flex; gap: 32px; }
    .list { flex: 0 0 200px; }
    .list ul { list-style: none; padding: 0; margin: 0; }
    .list li { margin: 8px 0; }
    .list a { color: #0066cc; text-decoration: none; padding: 4px 8px; display: block; border-radius: 4px; }
    .list a:hover { background: #f0f0f0; }
    .list a.active { background: #0066cc; color: white; }
    .detail { flex: 1; padding: 16px; background: #f9f9f9; border-radius: 8px; min-height: 200px; }
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
      <div class="container">
        <div class="list">
          <h3>Solar System</h3>
          <ul>
            ${this.people.map(person => html`
              <li>
                <a
                  ${uiSrefActive({ activeClasses: ['active'] })}
                  ${uiSref('.person', { personId: person.id })}
                >${person.name}</a>
              </li>
            `)}
          </ul>
        </div>
        <div class="detail">
          <ui-view>
            <p style="color: #666; font-style: italic;">Select a planet from the list</p>
          </ui-view>
        </div>
      </div>
    `;
  }
}

@customElement('person-detail')
class PersonDetailComponent extends LitElement {
  static styles = css`
    h3 { margin-top: 0; color: #333; }
    p { color: #666; line-height: 1.6; }
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
      return html`<p>Planet not found</p>`;
    }
    return html`
      <h3>${this.person.name}</h3>
      <p>${this.person.description}</p>
    `;
  }
}

@customElement('app-root')
class AppRoot extends LitElement {
  static styles = css`
    h2 { color: #333; }
    nav { margin-bottom: 24px; }
    nav a { margin-right: 16px; color: #333; text-decoration: none; }
    nav a.active { font-weight: bold; border-bottom: 2px solid #0066cc; }
  `;

  render() {
    return html`
      <h2>Hello Galaxy</h2>
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('people')}>Solar System</a>
      </nav>
      <ui-view></ui-view>
    `;
  }
}

// State definitions
const peopleState: LitStateDeclaration = {
  name: 'people',
  url: '/people',
  component: PeopleContainerComponent,
  resolve: [
    {
      token: 'people',
      resolveFn: () => PeopleService.getAllPeople(),
    },
  ],
};

const personState: LitStateDeclaration = {
  name: 'people.person',
  url: '/:personId',
  component: PersonDetailComponent,
  resolve: [
    {
      token: 'person',
      deps: ['$transition$', 'people'],
      resolveFn: ($transition$: any, people: Person[]) => {
        const personId = parseInt($transition$.params().personId);
        return people.find(p => p.id === personId);
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
  document.getElementById('root')!
);
```

---

## The State Tree

Here's how our states form a hierarchy:

```
app-root
└── <ui-view> (root viewport)
    └── people (/people)
        └── people-container
            └── <ui-view> (nested viewport)
                └── people.person (/people/:personId)
                    └── person-detail
```

When navigating to `/people/3`:
1. `people` state is activated (if not already active)
2. `PeopleContainerComponent` renders in the root `<ui-view>`
3. `people.person` state is activated
4. `PersonDetailComponent` renders in the nested `<ui-view>` inside `PeopleContainerComponent`

---

## Summary

You've now learned the core concepts of lit-ui-router:

| Tutorial | Concepts |
|----------|----------|
| Hello World | States, components, navigation with `uiSref`, basic routing |
| Hello Solar System | Resolves for data fetching, state parameters, accessing route data |
| Hello Galaxy | Nested states, nested ui-views, relative references, resolve inheritance |

## What's Next?

Explore the [Sample App](/app) to see a more complete example with:
- Authentication and protected routes
- Lazy-loaded states
- Sticky states and deep state redirect
- Complex view targeting
- And more!
