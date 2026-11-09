import { describe, expect, it, vi } from 'vitest';
import { LitElementRenderer } from '@lit-labs/ssr';
import { getByRole } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import {
  element,
  parseMarkup,
  shadowRoot,
  text,
} from '@tools/lit-test-env/ssr-tree.ts';
import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { srefHref, UIRouterLit } from 'lit-ui-router';
import {
  RouterContextRequestEvent,
  requestRouter,
} from 'lit-ui-router/context';
import { installServerLocation } from 'ui-router-server/location';
import { dehydrate, settle } from 'ui-router-server/ssr';

import type { HydrationSignature } from '../client.js';
import { prerender } from '../prerender.js';
import type { FileWriter } from '../prerender.js';
import { renderToString } from '../render.js';
import { signatureText } from './markup.js';

// `deps: []`, since core reads a bare function's dependencies from its source.
const resolved = <T>(token: string, resolveFn: () => T) => ({
  token,
  resolveFn,
  deps: [],
});

/** A router over `home`, `sheet` and a `plate` whose resolves take a string and a `Date`. */
const plateRouter = (): UIRouterLit => {
  const router = new UIRouterLit();
  installServerLocation(router, { urlConfig: { strict: false } });
  router.stateRegistry.register({ name: 'home', url: '/' });
  router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
  router.stateRegistry.register({
    name: 'plate',
    url: '/plate/:num',
    resolve: [
      resolved('title', () => 'Plate 7B'),
      resolved('when', () => new Date(0)),
    ],
  });

  return router;
};

/** A router settled on `path`. */
const settled = async (path: string): Promise<UIRouterLit> => {
  const router = plateRouter();
  await settle(router, path);

  return router;
};

const page = (): TemplateResult =>
  html`<main><a href=${srefHref('sheet', { num: '7B' })}>7B</a></main>`;

const signatureIn = (markup: string): HydrationSignature =>
  JSON.parse(signatureText(markup));

class RootProbe extends LitElement {
  override render(): TemplateResult {
    const router = requestRouter(this);

    return html`<span>${router ? router.globals.current.name : 'none'}</span>`;
  }
}

customElements.define('root-probe', RootProbe);

describe('renderToString', () => {
  it('writes the bytes prerender() writes for the same path', async () => {
    const files = new Map<string, string>();
    const write: FileWriter = (file, body) => void files.set(file, body);
    const prerendered = plateRouter();

    await prerender({
      mounts: {
        '/': {
          routes: [{ name: 'plate', url: '/plate/:num' }],
          config: { strict: false },
        },
      },
      router: prerendered,
      outDir: 'dist',
      paths: ['/plate/7B'],
      notFound: false,
      dehydrate: {},
      write,
      renderShell: async (_verdict, { subpath }) => {
        await settle(prerendered, subpath);

        return page();
      },
    });

    const { html: markup } = renderToString(page(), {
      router: await settled('/plate/7B'),
      dehydrate: {},
    });

    expect(markup).toBe(files.get('dist/plate/7B/index.html'));
  });

  it('opens on the signature of the state the router stands on, then the render', async () => {
    const { html: markup, payload } = renderToString(page(), {
      router: await settled('/sheet/9'),
    });

    expect(signatureIn(markup)).toEqual({
      version: expect.any(String),
      state: 'sheet',
      params: { num: '9' },
      views: [],
    });
    expect(
      getByRole(parseHtml(markup).body, 'link', { name: '7B' }).getAttribute(
        'href',
      ),
    ).toBe('/sheet/7B');
    expect(payload).toBeUndefined();
  });

  it('answers a context-request at the root during the render, and removes the provider after', async () => {
    const root = new EventTarget();
    const router = await settled('/');

    const { html: markup } = renderToString(html`<root-probe></root-probe>`, {
      router,
      root,
      elementRenderers: [LitElementRenderer],
    });

    const probe = element(parseMarkup(markup), 'root-probe');

    expect(text(element(shadowRoot(probe), 'span'))).toBe('home');

    let answered: UIRouterLit | undefined;
    root.dispatchEvent(
      new RouterContextRequestEvent((value) => (answered = value)),
    );
    expect(answered).toBeUndefined();
  });

  it('draws the payload dehydrate draws for the landed transition, and reports it', async () => {
    const router = await settled('/plate/7B');

    const { html: markup, payload } = renderToString(page(), {
      router,
      dehydrate: {},
    });

    expect(signatureIn(markup)).toMatchObject({
      state: 'plate',
      resolves: { plate: { title: 'Plate 7B' } },
    });
    expect(payload).toEqual({
      bytes: expect.any(Number),
      unserializable: [{ state: 'plate', token: 'when' }],
    });
  });

  it('carries a payload drawn by hand, reported by its bytes alone', async () => {
    const router = await settled('/plate/7B');
    const landed = router.globals.successfulTransitions.peekTail();

    const byHand = renderToString(page(), {
      router,
      payload: dehydrate(landed, {}).payload,
    });

    const built = renderToString(page(), { router, dehydrate: {} });

    expect(byHand.html).toBe(built.html);
    expect(byHand.payload).toEqual({ bytes: built.payload!.bytes });
  });

  it('throws when both dehydrate and payload are passed', async () => {
    const router = await settled('/plate/7B');
    const landed = router.globals.successfulTransitions.peekTail();

    expect(() =>
      renderToString(page(), {
        router,
        dehydrate: {},
        payload: dehydrate(landed, {}).payload,
      }),
    ).toThrow('pass `dehydrate` or `payload`, not both');
  });

  it('warns once per process when the current registry has no <ui-view>', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('customElements', new CustomElementRegistry());
    vi.resetModules();
    const fresh = await import('../render.js');
    const router = await settled('/');

    fresh.renderToString(page(), { router });
    fresh.renderToString(page(), { router });

    expect(
      warn.mock.calls.filter(([message]) =>
        String(message).includes('<ui-view> is not defined'),
      ),
    ).toHaveLength(1);
    vi.unstubAllGlobals();
    warn.mockRestore();
  });
});
