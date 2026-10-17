// The browser builds of lit that workerd resolves read these at module evaluation.
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

Object.assign(globalThis, {
  CSSStyleSheet,
  CustomElementRegistry,
  Document,
  Element,
  EventTarget,
  HTMLElement,
  ShadowRoot,
  customElements: new CustomElementRegistry(),
  document,
  window: globalThis,
});
