import {
  element,
  elements,
  lightChildren,
  outline,
  parseMarkup,
  outlineTree,
  text,
} from '@tools/lit-test-env/ssr-tree.ts';
import { describe, expect, it } from 'vitest';

import { rootTemplate } from './fixture.js';
import {
  cardPage,
  drawLight,
  framePage,
  outerPage,
  panelPage,
  plainPage,
} from './light-dom-fixture.js';

describe('the server render of a light-DOM element', () => {
  // The elements carry no `isServer` branch; their render reaches the page through the renderer alone.
  it('draws an opted-in element’s render into its light DOM, from its bound property', async () => {
    const tree = parseMarkup(await drawLight(cardPage('served'), '/bare'));
    const card = element(tree, 'light-card', { id: 'top' });

    expect(text(element(card, 'p', { class: 'card-label' }))).toBe('served');
    expect(elements(card, 'button', { class: 'card-button' })).toHaveLength(1);
    expect(elements(tree, 'template')).toEqual([]);
  });

  it('writes an element that did not opt in as today: tag and attributes, nothing inside', async () => {
    const tree = parseMarkup(await drawLight(plainPage, '/bare'));
    const plain = element(tree, 'plain-light-card', { id: 'plain' });

    expect(outline(plain)).toEqual([]);
    expect(plain.attrs).toEqual([
      { name: 'id', value: 'plain' },
      { name: 'defer-hydration', value: '' },
    ]);
  });

  it('draws the element’s render after the children its use site wrote', async () => {
    const tree = parseMarkup(await drawLight(panelPage, '/bare'));
    const panel = element(tree, 'light-panel', { id: 'panel' });
    const children = lightChildren(panel);

    const authored = children.indexOf(
      element(panel, 'p', { class: 'authored' }),
    );

    expect(authored).toBeGreaterThanOrEqual(0);
    expect(
      children.indexOf(element(panel, 'h2', { class: 'panel-heading' })),
    ).toBeGreaterThan(authored);
    expect(elements(panel, 'p', { class: 'authored' })).toHaveLength(1);
  });

  it('draws a light-DOM element a routed view holds', async () => {
    const tree = parseMarkup(await drawLight(rootTemplate, '/card'));

    expect(text(element(tree, 'light-card', { id: 'routed' }))).toContain(
      'routed',
    );
    expect(elements(tree, 'template')).toEqual([]);
  });

  it('draws a <ui-view> and its routed content inside a light-DOM element’s own render', async () => {
    const tree = parseMarkup(await drawLight(framePage, '/card'));
    const frame = element(tree, 'light-frame', { id: 'frame' });

    expect(elements(frame, 'h2', { class: 'frame-heading' })).toHaveLength(1);
    expect(elements(frame, 'ui-view')).toHaveLength(1);
    expect(text(element(tree, 'light-card', { id: 'routed' }))).toContain(
      'routed',
    );
  });

  it('draws two levels of light-DOM elements, each from its bound property', async () => {
    const tree = parseMarkup(await drawLight(outerPage, '/bare'));
    const outer = element(tree, 'light-outer', { id: 'outer' });

    expect(elements(outer, 'h2', { class: 'outer-heading' })).toHaveLength(1);
    expect(text(element(outer, 'light-card', { id: 'inner' }))).toContain(
      'Outer inner',
    );
    expect(elements(tree, 'template')).toEqual([]);
  });

  it('prerenders a LightDomHydrating routed class into its light DOM, not a shadow root', async () => {
    const tree = parseMarkup(await drawLight(rootTemplate, '/routed-class'));
    const card = element(tree, 'routed-light-card');

    expect(card.attrs).toEqual([{ name: 'defer-hydration', value: '' }]);
    // The node marker before `<p>` is what the element's hydrate binds `data-label` against.
    expect(outlineTree(card, { digests: false }).slice(0, 4)).toEqual([
      'served:{open *}',
      'served:{node 0}',
      '<p class="routed-light" data-label="routed class">',
      '  served:{open}',
    ]);
    expect(text(card)).toContain('routed class');
    expect(elements(tree, 'template')).toEqual([]);
  });
});
