import { html, LitElement, css, render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import { UIRouterLit, uiSref, uiSrefActive } from 'lit-ui-router';

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
    nav a.active {
      background: light-dark(#e0e0e0, #444);
    }
  `;

  render() {
    return html`
      <nav aria-label="Hello World (No Build)">
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('hello')}
          >Hello</a
        >
        <a ${uiSrefActive({ activeClasses: ['active'] })} ${uiSref('about')}
          >About</a
        >
      </nav>
      <ui-view></ui-view>
    `;
  }
}

customElements.define('app-root', AppRoot);

// State definitions
const helloState = {
  name: 'hello',
  url: '/hello',
  component: () => html`<h3>Hello World!</h3>`,
};

const aboutState = {
  name: 'about',
  url: '/about',
  component: () =>
    html`<h3>About</h3>
      <p>This page loads as written: an import map, no build step.</p>`,
};

// Router setup
const router = new UIRouterLit();

router.plugin(hashLocationPlugin);

// Logs each transition to the console.
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
  document.getElementById('root') ?? document.body,
);
