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
import { LitViewConfig } from '../pure.js';

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

// The served renderer (#1528) feature-detects the helpers through a namespace
// import and calls them with a plain UIRouter, as getScopedRouter hands it one,
// for a template, a class or a sticky class's bound renderer alike.
export const servedTemplate = (
  router: UIRouter,
  config: LitViewConfig,
): { template: TemplateResult; element?: Element } | undefined => {
  const detected: Partial<typeof pure> = pure;
  // SAFETY: a `LitViewConfig` is built only from a lit state's normalized view declaration
  const { component } = config.viewDecl as NormalizedLitViewDeclaration;

  if (!detected.routedViewTemplate || !detected.routedElementOf) {
    return undefined;
  }

  const template = detected.routedViewTemplate(
    component,
    router,
    new ResolveContext(config.path),
  );

  return { template, element: detected.routedElementOf(template) };
};

// The served view (#1528) hands its element over through the same namespace.
export const handOver = (view: pure.UiView, element: Element): void => {
  const detected: Partial<typeof pure> = pure;

  detected.adoptServedElement?.(view, element);
};
