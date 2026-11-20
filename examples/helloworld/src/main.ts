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
export class AppRoot extends LitElement {
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
  document.getElementById('root')!,
);
