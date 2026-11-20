import { css, html, LitElement, render } from 'lit';
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

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
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
  `;

  render() {
    return html`
      <nav aria-label="Features">
        <a ${current} ${uiSref('routing')}>Routing</a>
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
  static styles = css`
    ui-view {
      display: block;
      padding: 0 12px;
      border: 1px dashed currentColor;
      border-radius: 8px;
    }
  `;

  render() {
    return html`
      <h2>Nested views</h2>
      <p>
        This parent state, <code>nested</code> at <code>/nested</code>, renders
        in the root ui-view and places a second ui-view below. Activating the
        child state appends its URL to the parent's and renders its component
        inside that nested view. This parent stays in place while only the inner
        view changes. Select <a ${uiSref('.child')}>Open child state</a> to open
        the child state below.
      </p>
      <ui-view>
        <p>
          No child state is active yet. Select Open child state above to render
          one here.
        </p>
      </ui-view>
    `;
  }
}

// Reads its own declaration back from the router's registry.
const RoutingPage: RoutedLitTemplate = ({ router }) => {
  const { name, url } = router.stateService.get('routing');

  return html`
    <h2>State-based routing</h2>
    <p>
      This view is the <code>${name}</code> state, matched to
      <code>${url}</code>. Each link above points to a state by name; the router
      builds its URL and renders that state's component here. It comes from this
      declaration:
    </p>
    <pre><code>{ name: '${name}', url: '${url}', component: RoutingPage }</code></pre>
    <p>
      Use the links above to move between states and see each transition update
      the view.
    </p>
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
    Before <code>resolves</code> activates, the router runs its resolve and
    passes these values into the component:
  </p>
  <dl>
    <dt>Source</dt>
    <dd>${resolves.visit.source}</dd>
    <dt>Visit</dt>
    <dd>${resolves.visit.visit}</dd>
    <dt>Resolved at</dt>
    <dd>${resolves.visit.resolvedAt}</dd>
  </dl>
  <p>
    Leave this state and come back to run the resolve again and see the visit
    count update. By default, if a resolve throws or rejects, the transition
    fails before the state activates and the current view stays in place.
  </p>
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
    <h3>Child state</h3>
    <p>
      This component is <code>nested.child</code> at <code>/nested/child</code>,
      rendered inside <code>nested</code>'s nested ui-view. The parent state
      above stays active while this child fills only the inner view.
    </p>
    <p><a ${uiSref('^')}>Close child state</a></p>
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
