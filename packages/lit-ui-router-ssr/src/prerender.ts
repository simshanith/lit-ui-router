// provideRouter() on a render root, withRouterSync() around a synchronous render, verdicts turned into files and host rules.
import { render } from '@lit-labs/ssr';
import type { RenderInfo } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import type { TemplateResult } from 'lit';
import type { UIRouterLit } from 'lit-ui-router';
import { provideRouter, withRouterSync } from 'lit-ui-router/context';
import { createServerRouter } from 'ui-router-server';
import type { MountConfig, ServerRouter, Verdict } from 'ui-router-server';

import { UiViewRenderer } from './ui-view-renderer.js';

/** One emitted artefact, as {@link prerender} planned it. */
export interface EmittedPage {
  /** The requested path, exactly as the caller listed it. */
  path: string;
  /** Path relative to `outDir` — `sheet/7B/index.html`. */
  file: string;
  /** The verdict that produced it; `status` carries the otherwise projection's 404. */
  verdict: Verdict;
  /** Bytes written, or planned under `dryRun`. */
  bytes: number;
}

/** One host rules line: `from to status`, in `_redirects` order. */
export interface RedirectLine {
  /** Source path, host-absolute. */
  from: string;
  /** Target path, or an absolute url. */
  to: string;
  /** Status the host answers with. */
  status: number;
}

/** What a render hook is handed besides the verdict. */
export interface RenderContext {
  /** The requested path. */
  path: string;
  /** Path relative to the mount that owned it, `''` at the mount root. */
  subpath: string;
  /** Path of the file this render becomes, relative to `outDir`. */
  file: string;
  /** The render's root event target — the one the router was provided on. */
  root: EventTarget;
}

/**
 * Where {@link prerender} writes. Supply one to emit into memory or a virtual
 * fs. `file` arrives with `outDir` already joined on, so a hook writes it
 * verbatim.
 */
export type FileWriter = (file: string, body: string) => void | Promise<void>;

/** Options for {@link prerender}. */
export interface PrerenderOptions {
  /** The mount table, compiled here — or pass an already-compiled {@link PrerenderOptions.resolver | resolver}. */
  mounts?: Record<string, MountConfig>;
  /** A resolver from `createServerRouter`, instead of {@link PrerenderOptions.mounts | mounts}. */
  resolver?: ServerRouter;
  /**
   * The router the render reads: provided on {@link PrerenderOptions.root | root}
   * for `context-request` and scoped with `withRouterSync` around every render,
   * so `<ui-router>` descendants and the sref attribute directives both find it.
   */
  router: UIRouterLit;
  /** Every path to ask for a verdict. Redirect and notFound paths belong here too. */
  paths: Iterable<string> | AsyncIterable<string>;
  /** Directory the files are written under. */
  outDir: string;
  /**
   * Renders one shell verdict. Return a template and this package renders it;
   * return a string and it is written as-is. Async, so a hook may drive
   * {@link PrerenderOptions.router | router} to the path before it returns.
   */
  renderShell: (
    verdict: Extract<Verdict, { kind: 'shell' }>,
    context: RenderContext,
  ) => TemplateResult | string | Promise<TemplateResult | string>;
  /**
   * Wraps a rendered body in the page document — the shell html, its `<title>`,
   * its head. Defaults to the body unchanged. This package never parses or
   * rewrites html.
   */
  document?: (body: string, context: RenderContext) => string | Promise<string>;
  /**
   * The 404 document, emitted once from the `otherwise` projection. `false`
   * emits none, and nothing is emitted when the probed mount declares no
   * projection.
   */
  notFound?:
    | false
    | {
        /** File to write, relative to `outDir`. Defaults to `404.html`. */
        file?: string;
        /**
         * A path no route claims. Defaults to a guaranteed-miss path under the
         * first mount, which only a {@link PrerenderOptions.mounts | mounts}
         * table can supply — pass one alongside a bare
         * {@link PrerenderOptions.resolver | resolver}.
         */
        probe?: string;
      };
  /**
   * `'_redirects'` (default) writes the Cloudflare Pages / Netlify file;
   * `'none'` writes nothing and leaves {@link PrerenderResult.rules} to the
   * caller; a function receives the lines and writes whatever the host reads.
   * No SPA catch-all is ever written — one turns every 404 into a 200.
   */
  rules?:
    | '_redirects'
    | 'none'
    | ((lines: RedirectLine[]) => void | Promise<void>);
  /** Lines prepended to the generated ones, verbatim — a site's own legacy redirects. */
  extraRules?: RedirectLine[];
  /**
   * `'both'` (default) emits every generated redirect line twice, with and
   * without the trailing slash: a static host that appends one would otherwise
   * miss the rule. Shell verdicts need no pairing — they are written as
   * `<subpath>/index.html`, which both spellings reach.
   */
  trailingSlash?: 'both' | 'exact';
  /**
   * The render's root event target. A bare `new EventTarget()` is created when
   * none is passed; either way {@link PrerenderOptions.router | router} is
   * provided on it, it reaches every render on `eventTargetStack`, and it is
   * returned on the result so the caller can attach providers of its own
   * before the call.
   */
  root?: EventTarget;
  /**
   * Element renderers passed through to `@lit-labs/ssr`, verbatim. Defaults to
   * `[UiViewRenderer]` — not `@lit-labs/ssr`'s `[LitElementRenderer]`, which
   * wraps every custom element in a declarative shadow root it never asked for.
   * Pass `[]` for a render with no `<ui-view>` to fill.
   */
  elementRenderers?: RenderInfo['elementRenderers'];
  /** Writes a file. Defaults to `node:fs`, imported lazily on first write. */
  write?: FileWriter;
  /** Plans everything and writes nothing — neither pages nor the rules file. */
  dryRun?: boolean;
}

/** Counts of what {@link prerender} emitted. */
export interface PrerenderTally {
  /** Shell verdicts written as `<subpath>/index.html`. */
  shell: number;
  /** Redirect verdicts, counted once each however many rules lines they produced. */
  redirect: number;
  /** Paths that matched nothing — see {@link PrerenderResult.warnings}. */
  notFound: number;
  /** The 404 document: 1 when the projection produced one, 0 otherwise. */
  document: number;
}

/** What {@link prerender} did. */
export interface PrerenderResult {
  /** Counts by verdict kind, plus the 404 document. */
  tally: PrerenderTally;
  /** Every page written, in enumeration order. */
  pages: EmittedPage[];
  /** Every rules line, in written order, `extraRules` first. */
  rules: RedirectLine[];
  /** Paths that verdicted `notFound` with no projection — nothing was emitted for them. */
  warnings: string[];
  /** The root event target, created or passed through. */
  root: EventTarget;
}

// Built at runtime so no node: specifier enters the static module graph; a supplied `write` needs none.
const NODE_FS = 'node:fs/promises';

const DEFAULT_NOT_FOUND_FILE = '404.html';

// A path no route claims, appended to a mount base for the otherwise probe.
const PROBE_SEGMENT = '__lit-ui-router-ssr-probe__';

const encoder = new TextEncoder();

const joinPath = (dir: string, file: string): string =>
  dir === '' ? file : `${dir.replace(/\/+$/, '')}/${file}`;

const dirOf = (file: string): string => {
  const cut = file.lastIndexOf('/');
  return cut === -1 ? '' : file.slice(0, cut);
};

// Typed structurally so src never pulls in @types/node.
interface NodeFsPromises {
  mkdir(path: string, options: { recursive: boolean }): Promise<unknown>;
  writeFile(path: string, data: string, encoding: string): Promise<void>;
}

const nodeWrite: FileWriter = async (file, body) => {
  const { mkdir, writeFile } = (await import(NODE_FS)) as NodeFsPromises;
  const dir = dirOf(file);
  if (dir) await mkdir(dir, { recursive: true });
  await writeFile(file, body, 'utf8');
};

// The mount-relative path: '' at the mount root, '/sheet/7B' below it.
const subpathIn = (mount: string, path: string): string => {
  const base = mount === '/' ? '' : mount.replace(/\/+$/, '');
  return path.startsWith(base)
    ? path.slice(base.length).replace(/\/+$/, '')
    : path;
};

// '<subpath>/index.html', or 'index.html' at the mount root.
const fileFor = (subpath: string): string => {
  const trimmed = subpath.replace(/^\/+/, '').replace(/\/+$/, '');
  return trimmed === '' ? 'index.html' : `${trimmed}/index.html`;
};

// The same path spelled the other way round, or undefined at the host root.
const otherSpelling = (from: string): string | undefined => {
  const paired = from.endsWith('/') ? from.replace(/\/+$/, '') : `${from}/`;
  return paired === '' || paired === from ? undefined : paired;
};

const defaultProbe = (
  mounts: Record<string, MountConfig> | undefined,
): string => {
  const base = mounts && Object.keys(mounts)[0];
  if (base === undefined) {
    throw new Error(
      'prerender() cannot derive a notFound probe from a bare `resolver`: pass `notFound.probe`, or `notFound: false`.',
    );
  }
  return `${base === '/' ? '' : base.replace(/\/+$/, '')}/${PROBE_SEGMENT}`;
};

// litServerRoot must lead: @lit-labs/ssr 4.1 makes any other first entry its own __eventTargetParent and the composed-path walk never ends; read per call because the shim installs on import.
const rootedStack = (root: EventTarget): EventTarget[] => {
  const litServerRoot = (globalThis as { litServerRoot?: EventTarget })
    .litServerRoot;
  return litServerRoot && litServerRoot !== root
    ? [litServerRoot, root]
    : [root];
};

const warnUnclaimed = (path: string): void => {
  // DEV folds away in dist/*.js; see check:dev-split and dev-warnings.json.
  if (!import.meta.env.DEV) return;
  console.warn(
    'lit-ui-router-ssr: no route matched this path and its mount declares no otherwise projection, so no page was emitted for it:',
    path,
  );
};

/**
 * Emits a static site from a mount table's verdicts: a shell verdict becomes
 * `<subpath>/index.html`, a redirect becomes a rules line and no page, and the
 * `otherwise` projection becomes the 404 document.
 *
 * The router is provided on the render root for `context-request` and scoped
 * with `withRouterSync` around each render, so a template's `<ui-router>`
 * descendants and its sref attribute directives read the same router. Renders
 * run one at a time: the scope is a module slot, so there is nothing to
 * parallelise.
 *
 * Pages are rendered with `deferHydration`, so every custom element one holds
 * carries `defer-hydration` and renders nothing until `hydrateRoot()`'s walk
 * reaches it on the client.
 *
 * @param options - the mount table, the router, the paths, and the hooks
 * @returns what was emitted, planned or written
 * @throws an `Error` when neither `mounts` nor `resolver` is supplied
 *
 * @example
 * ```ts
 * const result = await prerender({
 *   mounts,
 *   router,
 *   outDir: 'dist',
 *   paths: ['/', '/sheet/7B', '/legacy'],
 *   renderShell: async (verdict, { path }) => {
 *     await goTo(router, path);
 *     return page();
 *   },
 *   document: (body, { path }) => fillShell(titles.get(path), body),
 * });
 * ```
 */
export async function prerender(
  options: PrerenderOptions,
): Promise<PrerenderResult> {
  const {
    mounts,
    router,
    paths,
    outDir,
    renderShell,
    document,
    notFound,
    rules = '_redirects',
    extraRules = [],
    trailingSlash = 'both',
    elementRenderers = [UiViewRenderer],
    write = nodeWrite,
    dryRun = false,
  } = options;

  if (!options.resolver && !mounts) {
    throw new Error(
      'prerender() needs a mount table: pass `mounts`, or a `resolver` from createServerRouter().',
    );
  }
  const resolver: ServerRouter =
    options.resolver ?? createServerRouter({ mounts: mounts! });

  const root = options.root ?? new EventTarget();
  const tally: PrerenderTally = {
    shell: 0,
    redirect: 0,
    notFound: 0,
    document: 0,
  };
  const pages: EmittedPage[] = [];
  const generated: RedirectLine[] = [];
  const warnings: string[] = [];

  const emit = async (
    verdict: Verdict,
    path: string,
    subpath: string,
    file: string,
  ): Promise<void> => {
    const context: RenderContext = { path, subpath, file, root };
    const body = await renderShell(
      verdict as Extract<Verdict, { kind: 'shell' }>,
      context,
    );
    const markup =
      typeof body === 'string'
        ? body
        : withRouterSync(router, () =>
            collectResultSync(
              render(body, {
                // a fresh array per render: @lit-labs/ssr mutates the stack
                eventTargetStack: rootedStack(root),
                elementRenderers,
                // every custom element the page holds sleeps until the client's walk reaches it, top-level ones included
                deferHydration: true,
              }),
            ),
          );
    const html = document ? await document(markup, context) : markup;
    if (!dryRun) await write(joinPath(outDir, file), html);
    pages.push({ path, file, verdict, bytes: encoder.encode(html).length });
  };

  const uninstall = provideRouter(root, router);
  try {
    for await (const path of paths) {
      const verdict = await resolver.resolve(path);
      if (verdict.kind === 'shell') {
        const subpath = subpathIn(verdict.mount, path);
        tally.shell += 1;
        await emit(verdict, path, subpath, fileFor(subpath));
        continue;
      }
      if (verdict.kind === 'redirect') {
        tally.redirect += 1;
        const line: RedirectLine = {
          from: path,
          to: verdict.location,
          status: verdict.status,
        };
        generated.push(line);
        const paired =
          trailingSlash === 'both' ? otherSpelling(path) : undefined;
        if (paired !== undefined) generated.push({ ...line, from: paired });
        continue;
      }
      tally.notFound += 1;
      warnings.push(path);
      warnUnclaimed(path);
    }

    if (notFound !== false) {
      const probe = notFound?.probe ?? defaultProbe(mounts);
      const verdict = await resolver.resolve(probe);
      if (verdict.kind === 'shell' && verdict.status === 404) {
        tally.document += 1;
        await emit(
          verdict,
          probe,
          subpathIn(verdict.mount, probe),
          notFound?.file ?? DEFAULT_NOT_FOUND_FILE,
        );
      }
    }
  } finally {
    uninstall();
  }

  const lines = [...extraRules, ...generated];
  if (!dryRun && rules !== 'none') {
    if (typeof rules === 'function') {
      await rules(lines);
    } else if (lines.length > 0) {
      const body = lines
        .map((line) => `${line.from} ${line.to} ${line.status}`)
        .join('\n');
      await write(joinPath(outDir, '_redirects'), `${body}\n`);
    }
  }

  return { tally, pages, rules: lines, warnings, root };
}
