import { LitElement } from 'lit';

import { LightDomHydrating } from './light-dom-api.js';

// Type-level checks on #904's mixin: the compile is the assertion (package `typecheck`; the umbrella tsconfig covers src/specs), and nothing here runs.

class Base extends LitElement {
  static readonly kind: string = 'base';

  label = '';

  measure(): number {
    return this.label.length;
  }
}

const Opted = LightDomHydrating(Base);

/** The instance keeps the base's members and stays assignable to it. */
export const instanceKeepsBase = (element: InstanceType<typeof Opted>) => {
  const label: string = element.label;
  const size: number = element.measure();
  const asBase: Base = element;
  const asLit: LitElement = element;

  return { label, size, asBase, asLit };
};

/** The class keeps the base's static side. */
export const kind: string = Opted.kind;

/** An opted-in class can be subclassed, and the subclass still reads as the base. */
export class Subclass extends LightDomHydrating(Base) {
  extra = 1;
}

export const subclassKeepsBase = (element: Subclass): Base => element;

// @ts-expect-error the mixin takes a LitElement class
export const rejectsPlainElement = LightDomHydrating(HTMLElement);
