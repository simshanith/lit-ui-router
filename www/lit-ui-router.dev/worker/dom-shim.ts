// lit's browser build, which workerd resolves, reads these at module evaluation, so the entry imports this first.
import {
  CSSStyleSheet,
  CustomElementRegistry,
  Document,
  Element,
  EventTarget,
  HTMLElement,
  ShadowRoot,
  document,
} from '@lit-labs/ssr-dom-shim';

// SAFETY: an existing registry (node's lit build installs one) keeps its definitions.
const existing = (globalThis as { customElements?: object }).customElements;

Object.assign(globalThis, {
  CSSStyleSheet,
  CustomElementRegistry,
  Document,
  Element,
  EventTarget,
  HTMLElement,
  ShadowRoot,
  customElements: existing ?? new CustomElementRegistry(),
  document,
  window: globalThis,
});
