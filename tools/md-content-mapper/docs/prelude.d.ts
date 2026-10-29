// Names the docs use without importing, declared once for every fence.
import type * as Lit from 'lit';
import type * as LitDecorators from 'lit/decorators.js';
import type * as LitUiRouter from 'lit-ui-router';
import type * as Core from '@uirouter/core';

type Resolves = LitUiRouter.DefaultResolvesType;

declare global {
  const html: typeof Lit.html;
  const css: typeof Lit.css;
  const LitElement: typeof Lit.LitElement;

  type LitElement = Lit.LitElement;

  const customElement: typeof LitDecorators.customElement;
  const property: typeof LitDecorators.property;
  const state: typeof LitDecorators.state;

  const uiSref: typeof LitUiRouter.uiSref;
  const uiSrefActive: typeof LitUiRouter.uiSrefActive;
  const srefHref: typeof LitUiRouter.srefHref;
  const srefActiveClass: typeof LitUiRouter.srefActiveClass;
  const srefAriaCurrent: typeof LitUiRouter.srefAriaCurrent;
  const UIRouterLit: typeof LitUiRouter.UIRouterLit;

  type UIRouterLit = LitUiRouter.UIRouterLit;

  type LitStateDeclaration<T extends Resolves = Resolves> =
    LitUiRouter.LitStateDeclaration<T>;

  type UIViewInjectedProps<T extends Resolves = Resolves> =
    LitUiRouter.UIViewInjectedProps<T>;

  type Transition = Core.Transition;

  const hashLocationPlugin: typeof Core.hashLocationPlugin;

  /** The app's router instance. */
  const router: LitUiRouter.UIRouterLit;
}
