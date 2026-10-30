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

/** The markup between `<tag id="id" …>` and its close tag. */
const inside = (markup: string, tag: string, id: string): string => {
  const open = new RegExp(`<${tag}\\s[^>]*id="${id}"[^>]*>`).exec(markup);

  if (!open) throw new Error(`no <${tag} id="${id}"> in the markup`);
  const from = open.index + open[0].length;

  return markup.slice(from, markup.lastIndexOf(`</${tag}`));
};

describe('the server render of a light-DOM element', () => {
  // The elements carry no `isServer` branch; their render reaches the page through the renderer alone.
  it('draws an opted-in element’s render into its light DOM, from its bound property', async () => {
    const markup = await drawLight(cardPage('served'), '/bare');
    const card = inside(markup, 'light-card', 'top');

    expect(card).toMatch(/<p class="card-label">(<!--[^>]*-->)*served/);
    expect(card).toContain('class="card-button"');
    expect(markup).not.toContain('shadowroot');
  });

  it('writes an element that did not opt in as today: tag and attributes, nothing inside', async () => {
    const markup = await drawLight(plainPage, '/bare');

    expect(inside(markup, 'plain-light-card', 'plain')).toBe('');
    expect(markup).toMatch(/<plain-light-card\s+id="plain" defer-hydration>/);
  });

  it('draws the element’s render after the children its use site wrote', async () => {
    const markup = await drawLight(panelPage, '/bare');
    const panel = inside(markup, 'light-panel', 'panel');

    expect(panel.indexOf('class="authored"')).toBeGreaterThanOrEqual(0);
    expect(panel.indexOf('class="panel-heading"')).toBeGreaterThan(
      panel.indexOf('class="authored"'),
    );
    expect(panel.match(/class="authored"/g)).toHaveLength(1);
  });

  it('draws a light-DOM element a routed view holds', async () => {
    const markup = await drawLight(rootTemplate, '/card');

    expect(inside(markup, 'light-card', 'routed')).toContain('routed');
    expect(markup).not.toContain('shadowroot');
  });

  it('draws a <ui-view> and its routed content inside a light-DOM element’s own render', async () => {
    const markup = await drawLight(framePage, '/card');
    const frame = inside(markup, 'light-frame', 'frame');

    expect(frame).toContain('class="frame-heading"');
    expect(frame).toContain('<ui-view');
    expect(inside(markup, 'light-card', 'routed')).toContain('routed');
  });

  it('draws two levels of light-DOM elements, each from its bound property', async () => {
    const markup = await drawLight(outerPage, '/bare');

    expect(inside(markup, 'light-outer', 'outer')).toContain(
      'class="outer-heading"',
    );
    expect(inside(markup, 'light-card', 'inner')).toContain('Outer inner');
    expect(markup).not.toContain('shadowroot');
  });

  // Needs #1528 (ssr serves `<ui-view>` through core's helper and prerenders a routed class) and #1653 (core adopts the served class element) as well as #904. #1527's finding 5: every sample-app class view renders into light DOM, and `LitElementRenderer` always writes a declarative shadow root.
  it.todo(
    'prerenders a light-DOM routed class view (createRenderRoot() { return this }) into its light DOM, not a shadow root',
  );
});
