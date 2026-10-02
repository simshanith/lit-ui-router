/**
 * Sets `parent`'s content by parsing `html` off-document, then appending the
 * result — never assigning `parent.innerHTML` directly.
 *
 * The sole site of the happy-dom innerHTML workaround: the fragment parsing
 * algorithm connects a custom element with its subtree already present
 * (browsers upgrade it after parsing, on insertion), but happy-dom's
 * `innerHTML` setter on a connected parent connects the custom element
 * BEFORE its children are parsed in, so anything reading children at connect
 * sees none. Parsing into a detached `<template>` and appending its content
 * reproduces the browser order. Guarded by the conformance canary beside
 * this file (src/specs/happy-dom-conformance.spec.ts): when the canary
 * fails, happy-dom fixed it upstream, inline plain innerHTML at the call
 * sites and delete this.
 */
export function setInnerHTMLDetached(parent: Element, html: string): void {
  const template = document.createElement('template');
  template.innerHTML = html;
  parent.replaceChildren();
  parent.append(template.content);
}
