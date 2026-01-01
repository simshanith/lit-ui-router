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
  getPerson: (id: number): Promise<Person | undefined> =>
    Promise.resolve(people.find(p => p.id === id)),
};

// Components
@customElement('people-list')
class PeopleListComponent extends LitElement {
  static styles = css`
    ul { list-style: none; padding: 0; }
    li { margin: 8px 0; }
    a { color: #0066cc; text-decoration: none; }
    a:hover { text-decoration: underline; }
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
        ${this.people.map(person => html`
          <li>
            <a ${uiSref('person', { personId: person.id })}>${person.name}</a>
          </li>
        `)}
      </ul>
    `;
  }
}

@customElement('person-detail')
class PersonDetailComponent extends LitElement {
  static styles = css`
    .back-link { margin-top: 16px; display: block; }
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
    nav { margin-bottom: 16px; }
    nav a { margin-right: 16px; color: #333; text-decoration: none; }
    nav a.active { font-weight: bold; }
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
  document.getElementById('root')!
);
