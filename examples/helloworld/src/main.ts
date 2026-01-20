import { html, LitElement, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { render } from 'lit';
import { hashLocationPlugin } from '@uirouter/core';
import {
  UIRouterLit,
  uiSref,
  uiSrefActive,
  LitStateDeclaration,
} from 'lit-ui-router';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    nav a {
      padding: 8px 16px;
      text-decoration: none;
      color: #333;
      border-radius: 4px;
    }
    nav a:hover {
      background: #f0f0f0;
    }
    nav a.active {
      font-weight: bold;
      background: #e0e0e0;
    }
  `;

  render() {
    return html`
      <nav>
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
