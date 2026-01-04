import { html, LitElement, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  LitStateDeclaration,
  UIViewInjectedProps,
} from 'lit-ui-router';

// Data Service
interface Person {
  id: number;
  name: string;
  description: string;
}

const people: Person[] = [
  {
    id: 1,
    name: 'Sun',
    description: 'The star at the center of our solar system.',
  },
  {
    id: 2,
    name: 'Mercury',
    description: 'The smallest planet and closest to the Sun.',
  },
  {
    id: 3,
    name: 'Venus',
    description: 'The hottest planet with a thick atmosphere.',
  },
  {
    id: 4,
    name: 'Earth',
    description: 'Our home planet, the only known planet with life.',
  },
  {
    id: 5,
    name: 'Mars',
    description: 'The red planet, a target for future exploration.',
  },
];

const PeopleService = {
  getAllPeople: (): Promise<Person[]> => Promise.resolve(people),
};

// Components
@customElement('people-container')
class PeopleContainerComponent extends LitElement {
  static styles = css`
    .container {
      display: flex;
      gap: 32px;
    }
    .list {
      flex: 0 0 200px;
    }
    .list ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .list li {
      margin: 8px 0;
    }
    .list a {
      color: #0066cc;
      text-decoration: none;
      padding: 4px 8px;
      display: block;
      border-radius: 4px;
    }
    .list a:hover {
      background: #f0f0f0;
    }
    .list a.active {
      background: #0066cc;
      color: white;
    }
    .detail {
      flex: 1;
      padding: 16px;
      background: #f9f9f9;
      border-radius: 8px;
      min-height: 200px;
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
      <div class="container">
        <div class="list">
          <h3>Solar System</h3>
          <ul>
            ${this.people.map(
              (person) => html`
                <li>
                  <a
                    ${uiSrefActive({ activeClasses: ['active'] })}
                    ${uiSref('.person', { personId: person.id })}
                    >${person.name}</a
                  >
                </li>
              `,
            )}
          </ul>
        </div>
        <div class="detail">
          <ui-view>
            <p style="color: #666; font-style: italic;">
              Select a planet from the list
            </p>
          </ui-view>
        </div>
      </div>
    `;
  }
}

@customElement('person-detail')
class PersonDetailComponent extends LitElement {
  static styles = css`
    h3 {
      margin-top: 0;
      color: #333;
    }
    p {
      color: #666;
      line-height: 1.6;
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
    h2 {
      color: #333;
    }
    nav {
      margin-bottom: 24px;
    }
    nav a {
      margin-right: 16px;
      color: #333;
      text-decoration: none;
    }
    nav a.active {
      font-weight: bold;
      border-bottom: 2px solid #0066cc;
    }
  `;

  render() {
    return html`
      <h2>Hello Galaxy</h2>
      <nav>
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('people')}
          >Solar System</a
        >
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

// Child state (nested via dot notation)
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
        return people.find((p) => p.id === personId);
      },
    },
  ],
};

// Router setup
const router = new UIRouterLit();
router.plugin(hashLocationPlugin);
import('@uirouter/visualizer').then(({ Visualizer }) =>
  router.plugin(Visualizer),
);
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
