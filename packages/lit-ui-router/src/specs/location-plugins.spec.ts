import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { html } from 'lit';
import { hashLocationPlugin, pushStateLocationPlugin } from '@uirouter/core';

import { UIRouterLit } from '../core.js';
import { LitStateDeclaration } from '../interface.js';

// URL-shape invariants per location plugin, demoted from the e2e suite's
// location_plugins.cy.js: each e2e suite variant already boots the whole app
// under its plugin, so the per-plugin URL assertions live here at package level.
describe('location plugin URL shape', () => {
  const homeState: LitStateDeclaration = {
    name: 'home',
    url: '/home',
    component: () => html`<div>home</div>`,
  };

  let router: UIRouterLit;
  let originalHref: string;

  beforeEach(() => {
    originalHref = window.location.href;
    router = new UIRouterLit();
  });

  afterEach(() => {
    router.dispose();
    // replaceState restores the runner URL without firing hashchange/popstate
    window.history.replaceState(null, '', originalHref);
  });

  it('hashLocationPlugin routes in the URL fragment (URL contains #)', async () => {
    router.plugin(hashLocationPlugin);
    router.stateRegistry.register(homeState);
    router.start();

    await router.stateService.go('home');

    expect(window.location.href).toContain('#');
    expect(window.location.hash).toBe('#/home');
  });

  it('pushStateLocationPlugin routes with clean URLs (no #)', async () => {
    router.plugin(pushStateLocationPlugin);
    // Anchor pushState paths under the test runner's own document path
    router.urlService.config.baseHref = () => window.location.pathname;
    router.stateRegistry.register(homeState);
    router.start();

    await router.stateService.go('home');

    expect(window.location.href).not.toContain('#');
    expect(window.location.pathname.endsWith('/home')).toBe(true);
  });
});
