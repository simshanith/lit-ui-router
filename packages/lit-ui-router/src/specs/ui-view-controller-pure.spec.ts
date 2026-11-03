// The elements-free entry point: lit templates, controllers and uiSref, from the pure entry alone.
import { describe, it, expect, afterEach } from 'vitest';
import { html, LitElement } from 'lit';
import { memoryLocationPlugin } from '@uirouter/core';
import { routerGo, tick } from '@tools/lit-test-env/router.ts';

import {
  type LitStateDeclaration,
  UIRouterLit,
  UiViewController,
  uiSref,
  viewRendered,
} from '../pure.js';

const router = new UIRouterLit();

router.plugin(memoryLocationPlugin);

const states: LitStateDeclaration[] = [
  {
    name: 'hello',
    url: '/hello',
    component: () => html`<h1 class="hello">Hello</h1>`,
  },
  {
    name: 'about',
    url: '/about',
    component: () => html`<h1 class="about">About</h1>`,
  },
];

states.forEach((state) => router.stateRegistry.register(state));

class HelloApp extends LitElement {
  readonly view = new UiViewController(this, { router });

  render() {
    return html`<nav>
        <a class="hello-link" ${uiSref('hello')}>Hello</a>
        <a class="about-link" ${uiSref('about')}>About</a>
      </nav>
      <main>${this.view.outlet()}</main>`;
  }
}

customElements.define('test-pure-hello-app', HelloApp);

declare global {
  interface HTMLElementTagNameMap {
    'test-pure-hello-app': HelloApp;
  }
}

describe('UiViewController without lit-ui-router elements', () => {
  let app: HelloApp | undefined;

  afterEach(() => {
    app?.remove();
  });

  it('defines no lit-ui-router elements', () => {
    expect(customElements.get('ui-router')).toBeUndefined();
    expect(customElements.get('ui-view')).toBeUndefined();
  });

  it('swaps the outlet when a uiSref link in the host template is clicked', async () => {
    app = document.createElement('test-pure-hello-app');
    document.body.appendChild(app);
    await routerGo(router, 'hello');
    await viewRendered(router);
    // uiSref seeks its router a task after the first render
    await tick();

    const root = app.shadowRoot!;
    expect(root.querySelector('main h1.hello')).not.toBeNull();

    const about = root.querySelector<HTMLAnchorElement>('a.about-link')!;
    expect(about.getAttribute('href')).toBe('#/about');

    about.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    await tick();
    await viewRendered(router);

    expect(router.globals.current.name).toBe('about');
    expect(root.querySelector('main h1.about')).not.toBeNull();
    expect(root.querySelector('main h1.hello')).toBeNull();
  });
});
