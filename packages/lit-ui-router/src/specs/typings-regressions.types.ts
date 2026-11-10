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

// A normalized component keeps its 1.x type; the guards narrow it to its three kinds.
export const componentKind = (
  component: NormalizedLitViewDeclaration['component'],
): 'class' | 'bound class' | 'template' => {
  if (pure.isRoutedLitElement(component)) {
    const routed: pure.RoutedLitElement = component;
    void routed;

    return 'class';
  }

  if (pure.isRoutedClassRenderer(component)) {
    const bound: pure.RoutedLitElement = component[pure.routedClass];
    void bound;

    return 'bound class';
  }

  const template: pure.RoutedLitTemplate = component;
  // @ts-expect-error a plain template carries no class brand
  void template[pure.routedClass];

  return 'template';
};

// A 1.x consumer reading the normalized component as before still type-checks.
export const readAsBefore = (
  declaration: NormalizedLitViewDeclaration,
): pure.RoutedLitComponent => declaration.component;

// uiSrefActive's documented call shape type-checks against its exported params type (#1729).
export const srefActiveParams: pure.UiSrefActiveParams = {
  activeClasses: ['active'],
};
