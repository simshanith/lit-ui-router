import { html } from 'lit';
import type { TemplateResult } from 'lit';
import { ResolveContext } from '@uirouter/core';
import type { UIRouter } from '@uirouter/core';

import type {
  LitStateDeclaration,
  NormalizedLitViewDeclaration,
  UIViewInjectedProps,
} from '../interface.js';
import * as pure from '../pure.js';
import { isRoutedLitElement, LitViewConfig } from '../pure.js';

// Type-level regressions — the compile is the assertion (package `typecheck`;
// umbrella tsconfig covers src/specs); never executed. Runtime half
// (isLitViewDeclarationTemplate) lives in core.spec.ts.

// A template with REQUIRED props must be accepted as a bare view declaration
// alongside the object shape.
export const template = (props: UIViewInjectedProps) =>
  html`<div>${props.transition?.from().name}</div>`;

export const stateDecl: LitStateDeclaration = {
  name: 'typings-regression',
  views: {
    $default: template,
    header: { component: () => html`<header>Header</header>` },
  },
};

// The served renderer (#1528) feature-detects the helper through a namespace
// import and calls it with a plain UIRouter, as getScopedRouter hands it one.
export const servedTemplate = (
  router: UIRouter,
  config: LitViewConfig,
): TemplateResult | undefined => {
  const detected: Partial<typeof pure> = pure;
  // SAFETY: a `LitViewConfig` is built only from a lit state's normalized view declaration
  const { component } = config.viewDecl as NormalizedLitViewDeclaration;

  return detected.routedViewTemplate && !isRoutedLitElement(component)
    ? detected.routedViewTemplate(
        component,
        router,
        new ResolveContext(config.path),
      )
    : undefined;
};
