import { html } from 'lit';

import type { LitStateDeclaration, UIViewInjectedProps } from '../interface.js';

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
