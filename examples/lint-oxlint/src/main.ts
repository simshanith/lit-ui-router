import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  LitStateDeclaration,
  UIRouterLit,
  uiSref,
  uiSrefActive,
} from 'lit-ui-router';

// Positive control: delete `${uiSref('about')}` from the second anchor and
// `npm run lint` reports lit-ui-router/anchor-is-valid on it.
@customElement('app-root')
export class AppRoot extends LitElement {
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

const helloState: LitStateDeclaration = {
  name: 'hello',
  url: '/hello',
  component: () => html`<h3>Hello World!</h3>`,
};

const aboutState: LitStateDeclaration = {
  name: 'about',
  url: '/about',
  component: () => html`<h3>About</h3>`,
};

export const router = new UIRouterLit();
router.stateRegistry.register(helloState);
router.stateRegistry.register(aboutState);
