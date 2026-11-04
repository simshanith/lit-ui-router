import { describe, it, expect } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { getByText } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import {
  element,
  elements,
  getAttribute,
  outline,
  parseMarkup,
  text,
} from '@tools/lit-test-env/ssr-tree.ts';
import type { Element } from '@tools/lit-test-env/ssr-tree.ts';
import { html } from 'lit';
import type { TemplateResult } from 'lit';

import '../register.js';
import { srefActiveClass, srefAriaCurrent } from '../sref-active.js';

const emit = (template: TemplateResult) => collectResultSync(render(template));

/** The open declarative shadow root `host` leads with. */
const shadowRoot = (host: Element): Element => {
  expect(outline(host)[0]).toBe('<template>');
  const root = element(host, 'template');
  expect(getAttribute(root, 'shadowroot')).toBe('open');
  expect(getAttribute(root, 'shadowrootmode')).toBe('open');

  return root;
};

describe('@lit-labs/ssr emit', () => {
  it('leaves the sref status attributes as authored without a router', () => {
    const out = emit(
      html`<a
        class="nav ${srefActiveClass({ state: 'users', activeClasses: ['active'] })}"
        aria-current=${srefAriaCurrent({ state: 'users' })}
        >Users</a
      >`,
    );

    // an `<a>` without href has no link role, so find it by its text
    const link = getByText(parseHtml(out).body, 'Users');
    expect(link.getAttribute('class')).toBe('nav ');
    expect(link.hasAttribute('aria-current')).toBe(false);
  });

  it('should render <ui-router> as a slotted declarative shadow root', () => {
    const router = element(
      parseMarkup(emit(html`<ui-router><p>light</p></ui-router>`)),
      'ui-router',
    );

    expect(outline(router)).toEqual(['<template>', '<p>']);
    expect(elements(shadowRoot(router), 'slot')).toHaveLength(1);
    expect(text(element(router, 'p'))).toBe('light');
  });

  it('should render <ui-view> with its fallback kept in the light DOM (#803)', () => {
    const view = element(
      parseMarkup(emit(html`<ui-view><p>fallback</p></ui-view>`)),
      'ui-view',
    );

    expect(outline(view)).toEqual(['<template>', '<p>']);
    const [marker, slot] = outline(shadowRoot(view));
    expect(marker).toMatch(/^<!--lit-part /);
    expect(slot).toBe('<slot>');
    expect(text(element(view, 'p'))).toBe('fallback');
  });

  it('should render a shell of nested views without an empty shadow root', () => {
    const tree = parseMarkup(
      emit(
        html`<ui-router
          ><ui-view name="rail"><ui-view></ui-view></ui-view
        ></ui-router>`,
      ),
    );

    const views = elements(tree, 'ui-view');
    expect(views).toHaveLength(2);

    for (const view of views) {
      expect(outline(shadowRoot(view))).toContain('<slot>');
    }
  });
});
