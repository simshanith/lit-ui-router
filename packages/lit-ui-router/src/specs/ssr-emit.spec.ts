import { describe, it, expect } from 'vitest';
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { getByText } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import {
  element,
  getAttribute,
  parseMarkup,
  outlineTree,
} from '@tools/lit-test-env/ssr-tree.ts';
import { html } from 'lit';
import type { TemplateResult } from 'lit';

import '../register.js';
import { srefActiveClass, srefAriaCurrent } from '../sref-active.js';

const emit = (template: TemplateResult) => collectResultSync(render(template));

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
    const tree = parseMarkup(emit(html`<ui-router><p>light</p></ui-router>`));

    expect(outlineTree(tree, { digests: false })).toEqual([
      '{open *}',
      '<ui-router>',
      '  #shadow open',
      '    {open *}',
      '    <slot>',
      '    {close}',
      '  <p>',
      '    "light"',
      '{close}',
    ]);
    // lit also writes the pre-standard attribute beside shadowrootmode
    expect(getAttribute(element(tree, 'template'), 'shadowroot')).toBe('open');
  });

  it('should render <ui-view> with its fallback kept in the light DOM (#803)', () => {
    const tree = parseMarkup(emit(html`<ui-view><p>fallback</p></ui-view>`));

    expect(outlineTree(tree, { digests: false })).toEqual([
      '{open *}',
      '<ui-view>',
      '  #shadow open',
      '    {open *}',
      '    <slot>',
      '    {close}',
      '  <p>',
      '    "fallback"',
      '{close}',
    ]);
  });

  it('should render a shell of nested views without an empty shadow root', () => {
    const tree = parseMarkup(
      emit(
        html`<ui-router
          ><ui-view name="rail"><ui-view></ui-view></ui-view
        ></ui-router>`,
      ),
    );

    expect(outlineTree(tree, { digests: false })).toEqual([
      '{open *}',
      '<ui-router>',
      '  #shadow open',
      '    {open *}',
      '    <slot>',
      '    {close}',
      '  <ui-view name="rail">',
      '    #shadow open',
      '      {open *}',
      '      <slot>',
      '      {close}',
      '    <ui-view>',
      '      #shadow open',
      '        {open *}',
      '        <slot>',
      '        {close}',
      '{close}',
    ]);
  });
});
