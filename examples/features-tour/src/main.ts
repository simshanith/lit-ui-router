import { css, html, LitElement, render, type TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { hashLocationPlugin } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  type LitStateDeclaration,
  type RoutedLitTemplate,
} from 'lit-ui-router';

// aria-current="page" marks the exact state only; the class also covers a child, so Nested views stays lit on it.
const current = uiSrefActive({ activeClasses: ['active'] });

// The pages share these rules: <ui-view> renders into the light DOM of the element that holds it.
const pageStyles = css`
  h2 {
    margin-block: 20px 8px;
  }
  ul {
    padding-inline-start: 20px;
  }
  li + li {
    margin-block-start: 6px;
  }
  .demo {
    margin: 0;
    padding: 8px 12px;
    border: 1px dashed currentColor;
    border-radius: 8px;
  }
  .label {
    display: block;
    margin-block-end: 4px;
    font-size: 0.8125rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    margin: 0;
  }
  dd {
    margin: 0;
  }
`;

const guide = (path: string, text: string) =>
  html`(<a href=${path} target="_blank" rel="noopener">${text}</a>)`;

const docs = (path: string, text: string) =>
  guide(`https://lit-ui-router.dev${path}`, text);

const capabilities = (items: [string, string | TemplateResult][]) => html`
  <ul>
    ${items.map(
      ([title, body]) => html`<li><strong>${title}</strong> ${body}</li>`,
    )}
  </ul>
`;

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = [
    pageStyles,
    css`
      nav {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      nav a {
        padding: 6px 14px;
        border-radius: 999px;
        color: inherit;
        text-decoration: none;
      }
      @media (hover: hover) and (pointer: fine) {
        nav a:hover {
          background: light-dark(#f0f0f0, #2c2c2c);
        }
      }
      nav a:is([aria-current='page'], .active) {
        background: CanvasText;
        color: Canvas;
      }
    `,
  ];

  render() {
    return html`
      <nav aria-label="Features">
        <a ${current} ${uiSref('routing')}>States</a>
        <a ${current} ${uiSref('nested')}>Nested views</a>
        <a ${current} ${uiSref('resolves')}>Resolves</a>
      </nav>
      <ui-view></ui-view>
    `;
  }
}

// The parent state's component: its own <ui-view> is where the child state renders.
@customElement('nested-page')
export class NestedPage extends LitElement {
  static styles = pageStyles;

  render() {
    return html`
      <h2>Nested views</h2>
      <p>
        Each parent component can hold a ui-view for its children, keeping the
        outer layout mounted while inner states swap.
      </p>
      <div class="demo">
        <span class="label">Nested ui-view</span>
        <ui-view>
          <p>No child active. <a ${uiSref('nested.child')}>Show child</a></p>
        </ui-view>
      </div>
      ${capabilities([
        [
          'Shells, master/detail, and tabs.',
          html`Keep a persistent nav and content area, pair a list with a detail
          pane, or nest section sub-navigation.
          ${docs('/tutorial/hellogalaxy', 'Hello Galaxy')}`,
        ],
        [
          'Named views.',
          html`Give a parent several named ui-views and fill them from one
          state, or target a view on an ancestor.
          ${docs('/guides/named-views', 'Named Views')}`,
        ],
        [
          'Fallback content.',
          html`Markup inside a ui-view displays whenever no child state is
          active and returns when the child exits.
          ${docs('/guides/view-fallback-content', 'View Fallback Content')}`,
        ],
      ])}
    `;
  }
}

// The demo reads the state's own declaration back from the router's registry.
const RoutingPage: RoutedLitTemplate = ({ router }) => {
  const state = router.stateService.get('routing');

  return html`
    <h2>State-based routing</h2>
    <p>
      Model an app as a tree of named states, not flat paths. Each state
      declares its URL, component, and data, and children inherit from
      ancestors.
    </p>
    <p class="demo">
      Active state: <code>${state?.name}</code> · <code>${state?.url}</code>
    </p>
    ${capabilities([
      [
        'Links by state name.',
        html`Address states by name rather than raw URLs; the router builds each
        link's URL.
        ${docs('/guides/links-and-navigation', 'Links and Navigation')}`,
      ],
      [
        'Path and query parameters.',
        html`Declare typed URL segments, query parameters, defaults, and non-URL
        parameters inherited by children.
        ${docs('/guides/state-parameters', 'State Parameters')}`,
      ],
      [
        'Route guards.',
        html`Cancel or redirect transitions in one place across any state or
        subtree. ${docs('/guides/route-guards', 'Route Guards')}`,
      ],
      [
        'Redirects.',
        html`Forward a parent state to a default child, adjust parameters, or
        rewrite legacy paths. ${docs('/guides/redirects', 'Redirects')}`,
      ],
      [
        'Unmatched URLs.',
        html`Route unknown paths to a 404 state with no URL, keeping the
        attempted address.
        ${docs('/guides/unmatched-urls', 'Unmatched URLs (404)')}`,
      ],
      [
        'Abstract states.',
        html`Group children under a parent sharing a URL prefix, layout, data,
        or resolves without activating itself.
        ${guide(
          'https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html#abstract',
          'UI-Router abstract states',
        )}`,
      ],
    ])}
  `;
};

interface Visit {
  source: string;
  visit: number;
  resolvedAt: string;
}

type Resolved = { visit: Visit };

let visits = 0;

const ResolvesPage: RoutedLitTemplate<Resolved> = ({ resolves }) => html`
  <h2>Data resolves</h2>
  <p>
    By default, a transition waits for a state's resolves before activating it,
    so the component renders with its data ready instead of starting empty.
  </p>
  <div class="demo">
    <span class="label">Resolved data</span>
    <dl>
      <dt>Source</dt>
      <dd>${resolves.visit.source}</dd>
      <dt>Visit</dt>
      <dd>${resolves.visit.visit}</dd>
      <dt>Resolved at</dt>
      <dd>${resolves.visit.resolvedAt}</dd>
    </dl>
  </div>
  ${capabilities([
    [
      'Dependent and inherited resolves.',
      html`Resolves can read URL parameters from the transition, depend on other
      resolves, and inherit from ancestor states, including abstract states.
      ${docs('/tutorial/hellogalaxy#resolve-inheritance', 'Hello Galaxy')}`,
    ],
    [
      'Component inputs.',
      html`Routed components receive resolved values on
        <code>uiViewProps</code> (or as a template argument), typed from the
        state declaration.
        ${docs('/guides/routed-components', 'Routed Components')}`,
    ],
    [
      'Failures and loading states.',
      html`By default, a failed resolve stops navigation and keeps the current
      view; opt out of waiting to show a loading state, or use hooks to route to
      an error view.
      ${docs('/guides/loading-and-error-views', 'Loading and Error Views')}`,
    ],
  ])}
`;

// State definitions
const routingState: LitStateDeclaration = {
  name: 'routing',
  url: '/routing',
  component: RoutingPage,
};

const nestedState: LitStateDeclaration = {
  name: 'nested',
  url: '/nested',
  component: NestedPage,
};

const childState: LitStateDeclaration = {
  name: 'nested.child',
  url: '/child',
  component: () => html`
    <p>
      Child view · <code>nested.child</code> (<code>/nested/child</code>)
      <a ${uiSref('^')}>Hide child</a>
    </p>
  `,
};

const resolvesState: LitStateDeclaration<Resolved> = {
  name: 'resolves',
  url: '/resolves',
  component: ResolvesPage,
  resolve: [
    {
      token: 'visit',
      // Runs on each entry; the short local delay stands in for a fetch the transition waits for.
      resolveFn: () =>
        new Promise<Visit>((done) =>
          setTimeout(
            () =>
              done({
                source: 'Local promise',
                visit: ++visits,
                resolvedAt: new Date().toLocaleTimeString(),
              }),
            200,
          ),
        ),
    },
  ],
};

// Router setup
const router = new UIRouterLit();

router.plugin(hashLocationPlugin);

for (const state of [routingState, nestedState, childState, resolvesState])
  router.stateRegistry.register(state);

router.urlService.rules.initial({ state: 'routing' });

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
