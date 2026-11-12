import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LitElementRenderer } from '@lit-labs/ssr';
import { getByRole, getByText } from '@testing-library/dom';
import { parseHtml } from '@tools/lit-test-env/parse-html.ts';
import {
  element,
  elements,
  outline,
  parseMarkup,
  shadowRoot,
  text,
} from '@tools/lit-test-env/ssr-tree.ts';
import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import type { TemplateResult } from 'lit';
import { UIRouterLit } from 'lit-ui-router';
import { srefHref } from 'lit-ui-router';
import { requestRouter } from 'lit-ui-router/context';
import { createServerRouter } from 'ui-router-server';
import type { MountConfig } from 'ui-router-server';
import { installServerLocation } from 'ui-router-server/location';
import { dehydrate, settle } from 'ui-router-server/ssr';
import type { DehydrateOptions, Transporter } from 'ui-router-server/ssr';

import packageJson from '../../package.json' with { type: 'json' };

import { lightSlot } from '../client.js';
import { LightDomHydrating } from '../light-dom.js';
import { prerender } from '../prerender.js';
import { UiViewRenderer } from '../ui-view-renderer.js';
import type { HydrationSignature } from '../client.js';
import type { FileWriter, RedirectLine } from '../prerender.js';
import { signatureText, withoutSignature } from './markup.js';

// --- fixtures ------------------------------------------------------------

// The root mount projects an otherwise rule (unmatched paths become 404 shells); the /app mount has none (unmatched paths verdict notFound, nothing emitted). Both admit the trailing slash, as sheetRouter's urlConfig does.
const rootMount: MountConfig = {
  routes: [
    { name: 'home', url: '/' },
    { name: 'sheet', url: '/sheet/:num' },
    { name: 'notFound' },
  ],
  otherwise: { state: 'notFound' },
  config: { strict: false },
};

const appMount: MountConfig = {
  routes: [
    { name: 'welcome', url: '/welcome' },
    { name: 'legacy', url: '/legacy', redirectTo: 'welcome' },
  ],
  redirects: [{ pattern: /^\/?$/, to: 'welcome' }],
  config: { strict: false },
};

const mounts = {
  '/': rootMount,
  '/app': appMount,
} satisfies Record<string, MountConfig>;

const sheetRouter = (): UIRouterLit => {
  const router = new UIRouterLit();
  installServerLocation(router, { urlConfig: { strict: false } });
  router.stateRegistry.register({ name: 'home', url: '/' });
  router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });

  return router;
};

/** An in-memory {@link FileWriter} over a Map, plus the map it fills. */
const memoryWriter = () => {
  const files = new Map<string, string>();

  const write: FileWriter = (file, body) => void files.set(file, body);

  return { files, write };
};

const run = async (
  overrides: Partial<Parameters<typeof prerender>[0]> = {},
): Promise<{
  files: Map<string, string>;
  result: Awaited<ReturnType<typeof prerender>>;
}> => {
  const { files, write } = memoryWriter();

  const result = await prerender({
    mounts,
    router: sheetRouter(),
    outDir: 'dist',
    paths: ['/'],
    renderShell: () => '<p>page</p>',
    write,
    ...overrides,
  });

  return { files, result };
};

/** The signature block a page opens on, parsed. */
const signatureIn = (page: string): HydrationSignature =>
  JSON.parse(signatureText(page));

// --- verdict → artefact --------------------------------------------------

describe('shell verdicts', () => {
  it('writes <subpath>/index.html, and index.html at the mount root', async () => {
    const { files, result } = await run({
      paths: ['/', '/sheet/7B', '/app/welcome'],
    });

    expect([...files.keys()]).toEqual([
      'dist/index.html',
      'dist/sheet/7B/index.html',
      'dist/welcome/index.html',
      'dist/404.html',
    ]);
    expect(result.tally.shell).toBe(3);
    expect(result.pages[1]).toMatchObject({
      path: '/sheet/7B',
      file: 'sheet/7B/index.html',
      verdict: { kind: 'shell', mount: '/' },
    });
  });

  it('hands renderShell the mount-relative subpath and the target file', async () => {
    const seen: { subpath: string; file: string }[] = [];
    await run({
      paths: ['/', '/app/welcome'],
      notFound: false,
      renderShell: (_verdict, context) => {
        seen.push({ subpath: context.subpath, file: context.file });

        return '<p>page</p>';
      },
    });

    expect(seen).toEqual([
      { subpath: '', file: 'index.html' },
      { subpath: '/welcome', file: 'welcome/index.html' },
    ]);
  });
});

describe('redirect verdicts', () => {
  it('writes no page and a rules line per spelling carrying location and status', async () => {
    const { files, result } = await run({
      paths: ['/app/legacy'],
      notFound: false,
    });

    expect(result.tally).toMatchObject({ shell: 0, redirect: 1 });
    expect(result.pages).toEqual([]);
    expect(result.rules).toEqual([
      { from: '/app/legacy', to: '/app/welcome', status: 302 },
      { from: '/app/legacy/', to: '/app/welcome', status: 302 },
    ]);
    expect(files.get('dist/_redirects')).toBe(
      '/app/legacy /app/welcome 302\n/app/legacy/ /app/welcome 302\n',
    );
  });

  it('pairs the trailing slash and writes no line for a page by default', async () => {
    const { result } = await run({
      paths: ['/app/welcome', '/app/legacy'],
      notFound: false,
    });

    expect(result.rules.map((line) => line.from)).toEqual([
      '/app/legacy',
      '/app/legacy/',
    ]);
    expect(result.tally).toMatchObject({ shell: 1, redirect: 1 });
  });

  it("follows the mount's 'always' policy with a 308 from a page's other spelling", async () => {
    const always = {
      ...mounts,
      '/app': {
        ...appMount,
        config: { strict: false, trailingSlash: { pages: 'always' } },
      },
    } satisfies Record<string, MountConfig>;

    const { files, result } = await run({
      mounts: always,
      paths: ['/app/welcome/', '/app/legacy'],
      notFound: false,
    });

    expect([...files.keys()]).toEqual([
      'dist/welcome/index.html',
      'dist/_redirects',
    ]);
    expect(result.rules).toEqual([
      { from: '/app/welcome', to: '/app/welcome/', status: 308 },
      { from: '/app/legacy', to: '/app/welcome/', status: 302 },
      { from: '/app/legacy/', to: '/app/welcome/', status: 302 },
    ]);
  });
});

describe('a path that begins with //', () => {
  // ':lang' matches an empty segment, so '//about' names 'page' with an empty lang as written.
  const langMounts = {
    '/': {
      routes: [
        { name: 'page', url: '/:lang/:slug' },
        { name: 'about', url: '/about' },
        { name: 'bare', url: '/bare' },
      ],
    },
  } satisfies Record<string, MountConfig>;

  const langRouter = (): UIRouterLit => {
    const router = new UIRouterLit();
    installServerLocation(router);
    router.stateRegistry.register({ name: 'page', url: '/:lang/:slug' });
    router.stateRegistry.register({ name: 'about', url: '/about' });
    router.stateRegistry.register({
      name: 'bare',
      url: '/bare',
      redirectTo: () => ({ state: 'page', params: { lang: '', slug: 'x' } }),
    });

    return router;
  };

  // A link that carries the request's own ':lang' into its href.
  const linkAt = async (
    router: UIRouterLit,
    path: string,
  ): Promise<TemplateResult> => {
    await settle(router, path);
    const { lang = 'en' } = router.globals.params;

    return html`<a href=${srefHref('page', { lang, slug: 'next' })}>next</a>`;
  };

  it('renders no page for it, so no href that begins with // reaches markup', async () => {
    const router = langRouter();
    const rendered: string[] = [];

    const { files, result } = await run({
      mounts: langMounts,
      router,
      paths: ['//about', '/about', '//en/intro'],
      notFound: false,
      renderShell: (_verdict, { path }) => {
        rendered.push(path);

        return linkAt(router, path);
      },
    });

    expect(rendered).toEqual(['/about']);
    expect([...files.keys()]).toEqual([
      'dist/about/index.html',
      'dist/_redirects',
    ]);
    expect(
      getByRole(parseHtml(files.get('dist/about/index.html')!).body, 'link', {
        name: 'next',
      }).getAttribute('href'),
    ).toBe('/en/next');
    expect(result.rules).toEqual([
      { from: '//about', to: '/about', status: 308 },
      { from: '//about/', to: '/about', status: 308 },
      { from: '//en/intro', to: '/en/intro', status: 308 },
      { from: '//en/intro/', to: '/en/intro', status: 308 },
    ]);
  });

  it('keeps a redirect a render lands, to a state with an empty leading param, on this origin', async () => {
    const router = langRouter();

    const { files, result } = await run({
      mounts: langMounts,
      router,
      paths: ['/bare'],
      notFound: false,
      renderShell: (_verdict, { path }) => linkAt(router, path),
    });

    expect(result.pages).toEqual([]);
    expect(files.get('dist/_redirects')).toBe('/bare /x 302\n/bare/ /x 302\n');
  });
});

describe('unclaimed paths', () => {
  it('counts, warns and emits nothing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { files, result } = await run({
      paths: ['/app/missing'],
      notFound: false,
    });

    expect(result.tally.notFound).toBe(1);
    expect(result.warnings).toEqual(['/app/missing']);
    expect(result.pages).toEqual([]);
    expect(files.size).toBe(0);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no otherwise projection'),
      '/app/missing',
    );
    warn.mockRestore();
  });
});

describe('delegating states', () => {
  it("passes the loop's delegate count and list through, emitting nothing for them", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const delegating = {
      ...mounts,
      '/app': {
        ...appMount,
        routes: [
          ...appMount.routes,
          { name: 'claims', url: '/claims', delegate: 'ledger' },
        ],
      },
    };

    const { files, result } = await run({
      mounts: delegating,
      paths: ['/app/claims', '/app/welcome'],
      notFound: false,
    });

    expect(result.tally).toMatchObject({ shell: 1, delegate: 1, notFound: 0 });
    expect(result.delegated).toEqual(['/app/claims']);
    expect(result.pages.map((page) => page.path)).toEqual(['/app/welcome']);
    expect([...files.keys()]).toEqual(['dist/welcome/index.html']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('a mount that rejects the trailing slash', () => {
  const strict = { ...mounts, '/': { ...rootMount, config: {} } };

  it('warns once, naming the first page a static host would redirect', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = await run({
      mounts: strict,
      paths: ['/', '/sheet/7B', '/sheet/12'],
      notFound: false,
    });

    expect(result.tally.shell).toBe(3);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('strict: false'),
      '/sheet/7B',
    );
    warn.mockRestore();
  });

  it('stays silent when the mount admits it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await run({ paths: ['/', '/sheet/7B', '/app/welcome'], notFound: false });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('an unregistered <ui-view>', () => {
  it('warns once per call when the current registry has no <ui-view>', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // The registry the DOM shim installs when it finishes, after lit-ui-router defined into lit's own.
    vi.stubGlobal('customElements', new CustomElementRegistry());

    await run({ paths: ['/', '/sheet/7B'] });

    const unregistered = warn.mock.calls.filter(([message]) =>
      String(message).includes('<ui-view> is not defined'),
    );

    expect(unregistered).toEqual([
      [expect.stringContaining('dynamic import after the shim')],
    ]);
    vi.unstubAllGlobals();
    warn.mockRestore();
  });

  it('stays quiet when <ui-view> is defined', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await run();

    expect(customElements.get('ui-view')).toBeDefined();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('under node with NODE_ENV=production', () => {
  it('raises none of the prerender warnings', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('customElements', new CustomElementRegistry());

    const { result } = await run({
      mounts: { ...mounts, '/': { ...rootMount, config: {} } },
      paths: ['/sheet/7B', '/app/missing'],
      notFound: false,
    });

    expect(result.warnings).toEqual(['/app/missing']);
    expect(warn).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    warn.mockRestore();
  });
});

describe('the 404 document', () => {
  it('writes 404.html once, from the probe, at status 404', async () => {
    const seen: { path: string; status?: number }[] = [];

    const { files, result } = await run({
      paths: ['/'],
      renderShell: (verdict, context) => {
        seen.push({ path: context.path, status: verdict.status });

        return '<p>page</p>';
      },
    });

    expect(result.tally.document).toBe(1);
    expect(files.has('dist/404.html')).toBe(true);
    expect(seen[1]?.status).toBe(404);
    expect(seen[1]?.path).toContain('probe');
    expect(result.pages.at(-1)).toMatchObject({ file: '404.html' });
  });

  it('takes an explicit probe and file', async () => {
    const { files } = await run({
      paths: [],
      notFound: { probe: '/nothing-claims-this', file: 'not-found.html' },
    });

    expect([...files.keys()]).toEqual(['dist/not-found.html']);
  });

  it('emits none under `notFound: false`, and none when the mount has no projection', async () => {
    const off = await run({ paths: [], notFound: false });
    expect(off.files.size).toBe(0);

    const unprojected = await run({
      mounts: { '/app': appMount },
      paths: [],
      notFound: { probe: '/app/nothing-claims-this' },
    });

    expect(unprojected.files.size).toBe(0);
    expect(unprojected.result.tally.document).toBe(0);
  });
});

describe('the rules file', () => {
  it('never writes an SPA catch-all', async () => {
    const { files, result } = await run({ paths: ['/', '/app/legacy'] });

    expect(files.get('dist/_redirects')).not.toContain('/index.html 200');
    expect(result.rules.some((line) => line.from === '/*')).toBe(false);
  });

  it('leads with extraRules, in order and unpaired', async () => {
    const extraRules: RedirectLine[] = [
      { from: '/megacanvas', to: '/megacanvas.html', status: 301 },
      { from: '/old', to: '/', status: 308 },
    ];

    const { files, result } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      extraRules,
    });

    expect(result.rules.slice(0, 2)).toEqual(extraRules);
    expect(files.get('dist/_redirects')).toBe(
      [
        '/megacanvas /megacanvas.html 301',
        '/old / 308',
        '/app/legacy /app/welcome 302',
        '/app/legacy/ /app/welcome 302',
        '',
      ].join('\n'),
    );
  });

  it("fills result.rules but writes no file under 'none', and hands a function the same array", async () => {
    const none = await run({
      paths: ['/app/legacy'],
      notFound: false,
      rules: 'none',
    });

    expect(none.files.has('dist/_redirects')).toBe(false);
    expect(none.result.rules).toHaveLength(2);

    let received: RedirectLine[] | undefined;

    const hook = await run({
      paths: ['/app/legacy'],
      notFound: false,
      rules: (lines) => void (received = lines),
    });

    expect(hook.files.has('dist/_redirects')).toBe(false);
    expect(received).toEqual(hook.result.rules);
  });
});

describe('dryRun', () => {
  it('writes nothing and still tallies and sizes every page', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { files, result } = await run({
      paths: ['/', '/app/legacy', '/app/missing'],
      dryRun: true,
    });

    expect(files.size).toBe(0);
    expect(result.tally).toEqual({
      shell: 1,
      redirect: 1,
      notFound: 1,
      delegate: 0,
      response: 0,
      document: 1,
    });
    expect(result.rules).toHaveLength(2);
    expect(result.pages.every((page) => page.bytes > 0)).toBe(true);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no otherwise projection'),
      '/app/missing',
    );
    warn.mockRestore();
  });
});

describe('the default writer', () => {
  it('writes through node:fs, creating each page directory', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'lit-ui-router-ssr-'));

    try {
      // `write: undefined` reaches prerender's destructuring default, the node:fs writer.
      const { result } = await run({
        write: undefined,
        outDir,
        paths: ['/', '/sheet/7B', '/app/legacy'],
      });

      expect(result.tally).toMatchObject({
        shell: 2,
        redirect: 1,
        document: 1,
      });

      const read = (file: string): Promise<string> =>
        readFile(path.join(outDir, file), 'utf8');

      expect(await read('index.html')).toBe('<p>page</p>');
      expect(await read('sheet/7B/index.html')).toBe('<p>page</p>');
      expect(await read('404.html')).toBe('<p>page</p>');
      expect(await read('_redirects')).toBe(
        [
          '/app/legacy /app/welcome 302',
          '/app/legacy/ /app/welcome 302',
          '',
        ].join('\n'),
      );
    } finally {
      await rm(outDir, { recursive: true, force: true });
    }
  });
});

// --- the render seam -----------------------------------------------------

describe('renderShell return values', () => {
  it('renders a TemplateResult and writes a string verbatim', async () => {
    const templated = await run({
      paths: ['/'],
      notFound: false,
      renderShell: (): TemplateResult => html`<p>from a template</p>`,
    });

    expect(
      getByText(
        parseHtml(templated.files.get('dist/index.html')!).body,
        'from a template',
        { selector: 'p' },
      ),
    ).toBeDefined();

    const verbatim = await run({
      paths: ['/'],
      notFound: false,
      renderShell: () => '<p>verbatim</p>',
    });

    expect(verbatim.files.get('dist/index.html')).toBe('<p>verbatim</p>');
  });

  it('wraps the rendered body in `document`, and that is what lands', async () => {
    const { files } = await run({
      paths: ['/'],
      notFound: false,
      renderShell: (): TemplateResult => html`<p>body</p>`,
      document: (body, context) =>
        `<!doctype html><title>${context.path}</title><div id="root">${body}</div>`,
    });

    const written = parseHtml(files.get('dist/index.html')!);
    expect(written.title).toBe('/');
    // the mount point has no role, so it's found by id
    const root = written.querySelector('#root');
    expect(
      getByText(written.body, 'body', { selector: 'p' }).parentElement,
    ).toBe(root);
  });

  it('propagates a renderShell rejection and writes no rules file', async () => {
    const { files, write } = memoryWriter();

    await expect(
      prerender({
        mounts,
        router: sheetRouter(),
        outDir: 'dist',
        paths: ['/', '/app/legacy'],
        write,
        renderShell: () => Promise.reject(new Error('boom')),
      }),
    ).rejects.toThrow('boom');

    expect(files.has('dist/_redirects')).toBe(false);
  });
});

// --- the composition, the point of the package ---------------------------

class RouterProbe extends LitElement {
  override render(): TemplateResult {
    const router = requestRouter(this);

    return html`<span
      >${router ? router.stateService.href('sheet', { num: '7B' }) : 'no-router'}</span
    >`;
  }
}

customElements.define('router-probe', RouterProbe);

describe('the render composition', () => {
  it('reaches the sref attribute directives through withRouterSync', async () => {
    const { files } = await run({
      paths: ['/'],
      notFound: false,
      renderShell: (): TemplateResult =>
        html`<a href=${srefHref('sheet', { num: '7B' })}>7B</a>`,
    });

    expect(
      getByRole(parseHtml(files.get('dist/index.html')!).body, 'link', {
        name: '7B',
      }).getAttribute('href'),
    ).toBe('/sheet/7B');
  });

  it('answers a context-request that reaches the render root', async () => {
    const { files } = await run({
      paths: ['/'],
      notFound: false,
      // LitElementRenderer is not the default here; a shadow render asks for it.
      elementRenderers: [LitElementRenderer],
      renderShell: (): TemplateResult => html`<router-probe></router-probe>`,
    });

    // happy-dom's DOMParser leaves a declarative shadow root unattached, so parse5 reads it
    const probe = element(
      parseMarkup(files.get('dist/index.html')!),
      'router-probe',
    );

    expect(text(element(shadowRoot(probe), 'span'))).toBe('/sheet/7B');
  });

  it('defaults to the light-DOM renderers, so no element gets a shadow root it never asked for', async () => {
    const { files } = await run({
      paths: ['/'],
      notFound: false,
      renderShell: (): TemplateResult => html`<router-probe></router-probe>`,
    });

    expect(withoutSignature(files.get('dist/index.html')!)).toBe(
      '<!--lit-part l2LFYrjnTDM=--><router-probe defer-hydration></router-probe><!--/lit-part-->',
    );
  });

  it('defers every custom element on the page, the top-level one included', async () => {
    const { files } = await run({
      paths: ['/'],
      notFound: false,
      renderShell: (): TemplateResult => html`<ui-view></ui-view>`,
    });

    expect(
      element(parseMarkup(files.get('dist/index.html')!), 'ui-view').attrs,
    ).toEqual([{ name: 'defer-hydration', value: '' }]);
  });
});

/** A branded light-DOM element, drawn by the default renderers. */
class DefaultCard extends LightDomHydrating(LitElement) {
  @property()
  label = '';

  override render(): TemplateResult {
    return html`<p class="default-card">${this.label}</p>`;
  }
}

customElements.define('default-card', DefaultCard);

/** The same render, unbranded. */
class PlainCard extends LitElement {
  @property()
  label = '';

  override createRenderRoot(): this {
    return this;
  }

  override render(): TemplateResult {
    return html`<p class="plain-card">${this.label}</p>`;
  }
}

customElements.define('plain-card', PlainCard);

describe('the default element renderers', () => {
  const cards = (): TemplateResult =>
    html`<default-card .label=${'drawn'}>${lightSlot()}</default-card
      ><plain-card .label=${'plain'}>${lightSlot()}</plain-card>`;

  it('draws a branded light-DOM element into its light DOM', async () => {
    const { files } = await run({ notFound: false, renderShell: cards });
    const tree = parseMarkup(files.get('dist/index.html')!);
    const card = element(tree, 'default-card');

    // only markers come before the card's paragraph
    const children = outline(card);
    const at = children.indexOf('<p>');
    expect(at).toBeGreaterThanOrEqual(0);
    expect(
      children.slice(0, at).filter((label) => !label.startsWith('<!--')),
    ).toEqual([]);
    const label = element(card, 'p');
    expect(label.attrs).toEqual([{ name: 'class', value: 'default-card' }]);
    expect(text(label)).toBe('drawn');
    expect(elements(tree, 'template')).toEqual([]);
  });

  it('serves an unbranded element empty', async () => {
    const { files } = await run({ notFound: false, renderShell: cards });

    const card = element(
      parseMarkup(files.get('dist/index.html')!),
      'plain-card',
    );

    expect(card.attrs).toEqual([{ name: 'defer-hydration', value: '' }]);
    expect(outline(card)).toEqual(['<!--lit-part-->', '<!--/lit-part-->']);
  });

  it('gives way to an explicit elementRenderers list', async () => {
    const { files } = await run({
      notFound: false,
      renderShell: cards,
      elementRenderers: [UiViewRenderer],
    });

    const tree = parseMarkup(files.get('dist/index.html')!);

    // no shadow root either, so the light-DOM checks below see the whole render
    expect(elements(tree, 'template')).toEqual([]);
    expect(elements(tree, 'p', { class: 'default-card' })).toEqual([]);
    expect(text(tree)).not.toContain('drawn');
  });
});

describe('the hydration signature', () => {
  const version = import.meta.env.PACKAGE_VERSION;

  /** Prerenders `paths` with a renderShell that settles the router on each one first. */
  const settled = (
    paths: string[],
    overrides: Partial<Parameters<typeof prerender>[0]> = {},
  ) => {
    const router = sheetRouter();

    return run({
      router,
      paths,
      notFound: false,
      ...overrides,
      renderShell: async (_verdict, { path }): Promise<TemplateResult> => {
        await settle(router, path);

        return html`<p>page</p>`;
      },
    });
  };

  it('opens a rendered page on the version, the state, its params and the views drawn', async () => {
    const { files } = await settled(['/sheet/7B']);
    const page = files.get('dist/sheet/7B/index.html')!;

    expect(signatureIn(page)).toEqual({
      version,
      state: 'sheet',
      params: { num: '7B' },
      views: [],
    });
    expect(outline(parseMarkup(withoutSignature(page)))[0]).toMatch(
      /^<!--lit-part /,
    );
  });

  it('reads the version from the manifest', () => {
    expect(version).toBe(packageJson.version);
  });

  it('keeps a param value that spells a script close inside the block', async () => {
    const awkward = `--><script>alert("x")</script><!--&'`;
    const { files } = await settled([`/sheet/${encodeURIComponent(awkward)}`]);
    const [page] = files.values();

    // one block, closed where the signature ends, with no raw angle bracket inside
    const json = signatureText(page);
    expect(json).not.toMatch(/[<>]/);
    expect(signatureIn(page)).toMatchObject({ params: { num: awkward } });
  });

  it('keeps the url params only, so a config param that cannot serialise stays out', async () => {
    interface Cyclic {
      self?: Cyclic;
    }

    const cyclic: Cyclic = {};
    cyclic.self = cyclic;
    const router = sheetRouter();
    router.stateRegistry.register({
      name: 'configured',
      url: '/configured?q',
      params: { blob: { value: () => cyclic }, big: { value: () => 1n } },
    });

    const { files } = await run({
      router,
      paths: ['/configured?q=1'],
      notFound: false,
      mounts: {
        '/': {
          routes: [{ name: 'configured', url: '/configured?q' }],
          config: { strict: false },
        },
      },
      renderShell: async (_verdict, { path }): Promise<TemplateResult> => {
        await settle(router, path);

        return html`<p>page</p>`;
      },
    });

    const [page] = files.values();

    expect(signatureIn(page)).toEqual({
      version,
      state: 'configured',
      params: { q: '1' },
      views: [],
    });
  });

  it('carries the resolves the payload hook draws for the landed transition', async () => {
    const seen: [string, string, string][] = [];

    const { files } = await settled(['/sheet/7B', '/sheet/9'], {
      payload: (transition, { path }) => {
        const { num } = transition.params();
        seen.push([path, transition.to().name ?? '', String(num)]);

        return {
          ...dehydrate(transition).payload,
          resolves: { sheet: { title: `</script> ${String(num)}` } },
        };
      },
    });

    expect(seen).toEqual([
      ['/sheet/7B', 'sheet', '7B'],
      ['/sheet/9', 'sheet', '9'],
    ]);

    const page = files.get('dist/sheet/7B/index.html')!;

    expect(signatureText(page)).not.toMatch(/[<>]/);
    expect(signatureIn(page)).toEqual({
      version,
      state: 'sheet',
      params: { num: '7B' },
      views: [],
      resolves: { sheet: { title: '</script> 7B' } },
    });
  });

  it('writes the same block without resolves when the hook returns none', async () => {
    const bare = await settled(['/sheet/7B']);
    const hooked = await settled(['/sheet/7B'], { payload: () => undefined });

    expect(hooked.files).toEqual(bare.files);
  });

  it('writes none ahead of a string renderShell returns', async () => {
    const { files } = await run({ paths: ['/'], notFound: false });

    expect(files.get('dist/index.html')).toBe('<p>page</p>');
  });
});

const transport = {
  Date: {
    encode: (value) => value instanceof Date && value.toISOString(),
    // SAFETY: `encode` above answers with an ISO string, the only encoding `decode` gets.
    decode: (encoded) => new Date(encoded as string),
  } satisfies Transporter<Date>,
};

// `deps: []`, since core reads a bare function's dependencies from its source.
const resolved = <T>(token: string, resolveFn: () => T) => ({
  token,
  resolveFn,
  deps: [],
});

/** Prerenders `paths` over a `plate` state whose resolves take a string, a `Date` and a site-wide manifest; `/plain` renders as a string. */
const plates = (
  paths: string[],
  overrides: Partial<Parameters<typeof prerender>[0]> = {},
) => {
  const router = sheetRouter();
  router.stateRegistry.register({
    name: 'plate',
    url: '/plate/:num',
    resolve: [
      resolved('title', () => 'Plate 7B'),
      resolved('when', () => new Date(0)),
      resolved('manifest', () => ['7B', '9']),
    ],
  });
  router.stateRegistry.register({ name: 'plain', url: '/plain' });

  return run({
    router,
    paths,
    notFound: false,
    mounts: {
      '/': {
        routes: [
          { name: 'plate', url: '/plate/:num' },
          { name: 'plain', url: '/plain' },
        ],
        config: { strict: false },
      },
    },
    ...overrides,
    renderShell: async (
      _verdict,
      { path },
    ): Promise<TemplateResult | string> => {
      await settle(router, path);

      return path === '/plain' ? '<p>plain</p>' : html`<p>page</p>`;
    },
  });
};

describe('the dehydrate option', () => {
  const keepManifestOut: DehydrateOptions['shouldDehydrate'] = ({ token }) =>
    token !== 'manifest';

  it.each<[string, DehydrateOptions]>([
    ['no options', {}],
    ['shouldDehydrate', { shouldDehydrate: keepManifestOut }],
    ['transport', { transport }],
    ['both', { shouldDehydrate: keepManifestOut, transport }],
  ])(
    'writes the signature a payload hook calling dehydrate() writes, given %s',
    async (_name, options) => {
      const paths = ['/plate/7B', '/plate/9'];
      const built = await plates(paths, { dehydrate: options });

      const hooked = await plates(paths, {
        payload: (transition) => dehydrate(transition, options).payload,
      });

      expect(built.files).toEqual(hooked.files);
    },
  );

  it('carries what shouldDehydrate keeps and transport encodes', async () => {
    const { files } = await plates(['/plate/7B'], {
      dehydrate: { shouldDehydrate: keepManifestOut, transport },
    });

    expect(signatureIn(files.get('dist/plate/7B/index.html')!)).toMatchObject({
      state: 'plate',
      resolves: {
        plate: { title: 'Plate 7B', when: '1970-01-01T00:00:00.000Z' },
      },
      transported: { plate: { when: [{ type: 'Date', path: [] }] } },
    });
  });

  it('throws when a payload hook is passed too', async () => {
    await expect(
      plates(['/plate/7B'], { dehydrate: {}, payload: () => undefined }),
    ).rejects.toThrow('pass `dehydrate` or `payload`, not both');
  });
});

describe('the payload report', () => {
  /** The bytes the signature's `resolves` and `transported` add to `page`, as written. */
  const addedBytes = (page: string): number => {
    const {
      resolves: _resolves,
      transported: _transported,
      ...bare
    } = signatureIn(page);

    return signatureText(page).length - JSON.stringify(bare).length;
  };

  it('reports the bytes and unserializable resolves of a page dehydrate drew', async () => {
    const { files, result } = await plates(['/plate/7B'], { dehydrate: {} });

    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].payload).toEqual({
      bytes: addedBytes(files.get('dist/plate/7B/index.html')!),
      unserializable: [{ state: 'plate', token: 'when' }],
    });
    expect(result.pages[0].payload!.bytes).toBeGreaterThan(0);
  });

  it('reports none unserializable when transport carries the value', async () => {
    const { result } = await plates(['/plate/7B'], {
      dehydrate: { transport },
    });

    expect(result.pages[0].payload?.unserializable).toEqual([]);
  });

  it('omits the field on a page with no payload', async () => {
    const { result } = await plates(['/plate/7B', '/plain'], {
      dehydrate: {},
    });

    const [plate, plain] = result.pages;

    expect(plate.payload).toBeDefined();
    expect(plain.path).toBe('/plain');
    expect(plain).not.toHaveProperty('payload');
  });

  it('omits the field when there is nothing to draw with or a hook returns none', async () => {
    const bare = await plates(['/plate/7B']);
    const hooked = await plates(['/plate/7B'], { payload: () => undefined });

    expect(bare.result.pages[0]).not.toHaveProperty('payload');
    expect(hooked.result.pages[0]).not.toHaveProperty('payload');
  });

  it('reports bytes only behind a payload hook', async () => {
    const options: DehydrateOptions = { transport };
    const built = await plates(['/plate/7B'], { dehydrate: options });

    const hooked = await plates(['/plate/7B'], {
      payload: (transition) => dehydrate(transition, options).payload,
    });

    expect(hooked.result.pages[0].payload).toEqual({
      bytes: built.result.pages[0].payload!.bytes,
    });
  });
});

describe('the render root', () => {
  it('is the same object in the context and on the result', async () => {
    const seen: EventTarget[] = [];

    const { result } = await run({
      paths: ['/'],
      notFound: false,
      renderShell: (_verdict, context) => {
        seen.push(context.root);

        return '<p>page</p>';
      },
    });

    expect(result.root).toBeInstanceOf(EventTarget);
    expect(seen[0]).toBe(result.root);
  });

  it('passes a supplied root through, and uninstalls the provider after the last render', async () => {
    const root = new EventTarget();
    const router = sheetRouter();

    const { result } = await run({
      paths: ['/'],
      notFound: false,
      root,
      router,
    });

    expect(result.root).toBe(root);
    expect(requestRouter(root)).toBeUndefined();
  });

  it("takes the shim's own litServerRoot, and context still reaches the render", async () => {
    // SAFETY: the @lit-labs/ssr DOM shim installs `litServerRoot` as an `EventTarget` on import.
    const root = (globalThis as { litServerRoot?: EventTarget }).litServerRoot;
    expect(root).toBeInstanceOf(EventTarget);

    const { files, result } = await run({
      paths: ['/'],
      notFound: false,
      root,
      elementRenderers: [LitElementRenderer],
      renderShell: (): TemplateResult => html`<router-probe></router-probe>`,
    });

    const probe = element(
      parseMarkup(files.get('dist/index.html')!),
      'router-probe',
    );

    expect(text(element(shadowRoot(probe), 'span'))).toBe('/sheet/7B');
    expect(result.root).toBe(root);
    expect(requestRouter(root!)).toBeUndefined();
  });

  it('uninstalls the provider even when a render throws', async () => {
    const root = new EventTarget();

    await expect(
      run({
        paths: ['/'],
        notFound: false,
        root,
        renderShell: () => Promise.reject(new Error('boom')),
      }),
    ).rejects.toThrow('boom');

    expect(requestRouter(root)).toBeUndefined();
  });
});

// --- inputs --------------------------------------------------------------

describe('inputs', () => {
  it('enumerates an AsyncIterable of paths', async () => {
    async function* paths(): AsyncGenerator<string> {
      for (const path of ['/', '/sheet/7B']) yield await Promise.resolve(path);
    }

    const { result } = await run({ paths: paths(), notFound: false });

    expect(result.pages.map((page) => page.path)).toEqual(['/', '/sheet/7B']);
  });

  it('accepts a compiled resolver instead of a mount table', async () => {
    const { files } = await run({
      mounts: undefined,
      resolver: createServerRouter({ mounts }),
      paths: ['/sheet/7B'],
      notFound: false,
    });

    expect([...files.keys()]).toEqual(['dist/sheet/7B/index.html']);
  });

  it('refuses a call with neither, and a default probe with no mount table', async () => {
    await expect(run({ mounts: undefined, paths: [] })).rejects.toThrow(
      /mount table/,
    );

    await expect(
      run({
        mounts: undefined,
        resolver: createServerRouter({ mounts }),
        paths: [],
      }),
    ).rejects.toThrow(/notFound.probe/);
  });
});
