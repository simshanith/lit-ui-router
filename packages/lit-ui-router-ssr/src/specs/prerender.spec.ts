import { describe, expect, it, vi } from 'vitest';
import { html, LitElement } from 'lit';
import type { TemplateResult } from 'lit';
import { UIRouterLit } from 'lit-ui-router';
import { srefHref } from 'lit-ui-router';
import { requestRouter } from 'lit-ui-router/context';
import { createServerRouter } from 'ui-router-server';
import type { MountConfig } from 'ui-router-server';
import { installServerLocation } from 'ui-router-server/location';

import { prerender } from '../prerender.js';
import type { FileWriter, RedirectLine } from '../prerender.js';

// --- fixtures ------------------------------------------------------------

// The root mount projects its otherwise rule, so unmatched paths under it are
// 404 shells; the /app mount declares none, so unmatched paths there verdict
// notFound and nothing is emitted for them.
const rootMount: MountConfig = {
  routes: [
    { name: 'home', url: '/' },
    { name: 'sheet', url: '/sheet/:num' },
    { name: 'notFound' },
  ],
  otherwise: { state: 'notFound' },
};

const appMount: MountConfig = {
  routes: [
    { name: 'welcome', url: '/welcome' },
    { name: 'legacy', url: '/legacy', redirectTo: 'welcome' },
  ],
};

const mounts: Record<string, MountConfig> = {
  '/': rootMount,
  '/app': appMount,
};

const sheetRouter = (): UIRouterLit => {
  const router = new UIRouterLit();
  installServerLocation(router, { strictMode: false });
  router.stateRegistry.register({ name: 'home', url: '/' });
  router.stateRegistry.register({ name: 'sheet', url: '/sheet/:num' });
  return router;
};

/** An in-memory {@link FileWriter} over a Map, plus the map it fills. */
const memoryWriter = (): { files: Map<string, string>; write: FileWriter } => {
  const files = new Map<string, string>();
  return { files, write: (file, body) => void files.set(file, body) };
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
  it('writes no page and one rules line carrying location and status', async () => {
    const { files, result } = await run({
      paths: ['/app/legacy'],
      notFound: false,
      trailingSlash: 'exact',
    });

    expect(result.tally).toMatchObject({ shell: 0, redirect: 1 });
    expect(result.pages).toEqual([]);
    expect(result.rules).toEqual([
      { from: '/app/legacy', to: '/app/welcome', status: 302 },
    ]);
    expect(files.get('dist/_redirects')).toBe('/app/legacy /app/welcome 302\n');
  });

  it("pairs the trailing slash under 'both' and not under 'exact'", async () => {
    const both = await run({ paths: ['/app/legacy'], notFound: false });
    expect(both.result.rules.map((line) => line.from)).toEqual([
      '/app/legacy',
      '/app/legacy/',
    ]);
    expect(both.result.tally.redirect).toBe(1);

    const exact = await run({
      paths: ['/app/legacy'],
      notFound: false,
      trailingSlash: 'exact',
    });
    expect(exact.result.rules.map((line) => line.from)).toEqual([
      '/app/legacy',
    ]);
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
    for (const trailingSlash of ['both', 'exact'] as const) {
      const { files, result } = await run({
        paths: ['/', '/app/legacy'],
        trailingSlash,
      });
      expect(files.get('dist/_redirects')).not.toContain('/index.html 200');
      expect(result.rules.some((line) => line.from === '/*')).toBe(false);
    }
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
    const { files, result } = await run({
      paths: ['/', '/app/legacy', '/app/missing'],
      dryRun: true,
    });

    expect(files.size).toBe(0);
    expect(result.tally).toEqual({
      shell: 1,
      redirect: 1,
      notFound: 1,
      document: 1,
    });
    expect(result.rules).toHaveLength(2);
    expect(result.pages.every((page) => page.bytes > 0)).toBe(true);
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
    expect(templated.files.get('dist/index.html')).toContain(
      '<p>from a template</p>',
    );

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

    const written = files.get('dist/index.html')!;
    expect(written).toContain('<title>/</title>');
    expect(written).toContain('<div id="root">');
    expect(written).toContain('<p>body</p>');
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

    expect(files.get('dist/index.html')).toContain('href="/sheet/7B"');
  });

  it('answers a context-request that reaches the render root', async () => {
    const { files } = await run({
      paths: ['/'],
      notFound: false,
      renderShell: (): TemplateResult => html`<router-probe></router-probe>`,
    });

    const written = files.get('dist/index.html')!;
    expect(written).toContain('/sheet/7B');
    expect(written).not.toContain('no-router');
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
