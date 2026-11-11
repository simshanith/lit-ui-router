import { LitElementRenderer } from '@lit-labs/ssr';
import {
  element,
  elements,
  parseMarkup,
  shadowRoot,
} from '@tools/lit-test-env/ssr-tree.ts';
import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { UIRouterLit } from 'lit-ui-router';
import { installServerLocation } from 'ui-router-server/location';
import { settle } from 'ui-router-server/ssr';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { lightSlot } from '../client.js';
import { LightDomHydrating } from '../light-dom.js';
import { LightElementRenderer } from '../light-element-renderer.js';
import { prerender } from '../prerender.js';
import type { FileWriter } from '../prerender.js';
import { renderToString, shadowElementRenderers } from '../render.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import { withoutSignature } from './markup.js';

/** A shell element: a shadow root around the page's `<ui-view>`. Each spec draws its own tag, since the warning is once per tag. */
class ShellRoot extends LitElement {
  override render(): TemplateResult {
    return html`<main><ui-view></ui-view></main>`;
  }
}

customElements.define('shell-root', ShellRoot);

class BareShell extends ShellRoot {}

customElements.define('bare-shell', BareShell);

class ProdShell extends ShellRoot {}

customElements.define('prod-shell', ProdShell);

class DrawnShell extends ShellRoot {}

customElements.define('drawn-shell', DrawnShell);

class StringShell extends ShellRoot {}

customElements.define('string-shell', StringShell);

class OptedShell extends ShellRoot {}

customElements.define('opted-shell', OptedShell);

/** A branded light-DOM element. */
class BrandedCard extends LightDomHydrating(LitElement) {
  override render(): TemplateResult {
    return html`<p>branded</p>`;
  }
}

customElements.define('branded-card', BrandedCard);

/** An unbranded element that renders into itself. */
class SelfCard extends LitElement {
  override createRenderRoot(): this {
    return this;
  }

  override render(): TemplateResult {
    return html`<p>light</p>`;
  }
}

customElements.define('self-card', SelfCard);

const fallbackWarnings = (warn: { mock: { calls: unknown[][] } }): string[] =>
  warn.mock.calls
    .map(([message]) => String(message))
    .filter((message) => message.includes('reached no renderer'));

/** Prerenders `/` with `body` as the page, and returns the page. */
const page = async (
  body: () => TemplateResult,
  elementRenderers?: Parameters<typeof prerender>[0]['elementRenderers'],
): Promise<string> => {
  const files = new Map<string, string>();
  const write: FileWriter = (file, text) => void files.set(file, text);
  const router = new UIRouterLit();
  installServerLocation(router);
  router.stateRegistry.register({ name: 'home', url: '/' });

  const options: Parameters<typeof prerender>[0] = {
    mounts: { '/': { routes: [{ name: 'home', url: '/' }] } },
    router,
    outDir: 'dist',
    paths: ['/'],
    notFound: false,
    renderShell: body,
    write,
  };

  // Left unset, prerender() takes its default list.
  if (elementRenderers) options.elementRenderers = elementRenderers;

  await prerender(options);

  return withoutSignature(files.get('dist/index.html')!);
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('a shadow-DOM element no listed renderer draws', () => {
  it('warns once per tag, naming it and the fix', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await page(() => html`<shell-root></shell-root>`);
    await page(() => html`<shell-root></shell-root><shell-root></shell-root>`);

    const warnings = fallbackWarnings(warn);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('<shell-root>');
    expect(warnings[0]).toContain(
      'Pass elementRenderers: shadowElementRenderers',
    );
  });

  it('still renders the bare tag, as the fallback does', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const body = () => html`<bare-shell class="root"></bare-shell>`;

    const warned = await page(body);
    // NODE_ENV=production closes #dev-gate under node, so the list goes to @lit-labs/ssr unchanged.
    vi.stubEnv('NODE_ENV', 'production');
    const unwarned = await page(body);

    expect(warned).toBe(unwarned);
    const root = element(parseMarkup(warned), 'bare-shell');
    expect(elements(root, 'template')).toEqual([]);
    expect(elements(root, 'ui-view')).toEqual([]);
  });

  it('warns from renderToString too, which draws through the same render', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const router = new UIRouterLit();
    installServerLocation(router);
    router.stateRegistry.register({ name: 'home', url: '/' });
    await settle(router, '/');

    renderToString(html`<string-shell></string-shell>`, { router });

    const warnings = fallbackWarnings(warn);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('<string-shell>');
  });

  it('is quiet in production', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubEnv('NODE_ENV', 'production');

    await page(() => html`<prod-shell></prod-shell>`);

    expect(fallbackWarnings(warn)).toEqual([]);
  });

  it('is quiet when LitElementRenderer is in the list, and draws the shell', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const markup = await page(
      () => html`<drawn-shell></drawn-shell>`,
      [UiViewRenderer, LightElementRenderer, LitElementRenderer],
    );

    expect(fallbackWarnings(warn)).toEqual([]);
    expect(
      elements(element(parseMarkup(markup), 'drawn-shell'), 'template'),
    ).not.toEqual([]);
  });

  it('is quiet under shadowElementRenderers, which draws the shell and its <ui-view>', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const markup = await page(
      () => html`<opted-shell></opted-shell>`,
      shadowElementRenderers,
    );

    expect(fallbackWarnings(warn)).toEqual([]);
    const shell = element(parseMarkup(markup), 'opted-shell');
    expect(elements(shadowRoot(shell), 'ui-view')).not.toEqual([]);
  });

  it('adds LitElementRenderer after the default list in shadowElementRenderers', () => {
    expect(shadowElementRenderers).toEqual([
      UiViewRenderer,
      LightElementRenderer,
      LitElementRenderer,
    ]);
  });

  it('is quiet for light-DOM elements, <ui-view> and <ui-router>', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await page(
      () =>
        html`<branded-card>${lightSlot()}</branded-card><self-card></self-card
          ><ui-router><ui-view></ui-view></ui-router>`,
    );
    await page(() => html`<self-card></self-card><ui-view></ui-view>`, []);

    expect(fallbackWarnings(warn)).toEqual([]);
  });
});
