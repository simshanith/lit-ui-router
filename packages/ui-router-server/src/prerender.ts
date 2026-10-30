/**
 * A static site from a mount table: each path's verdict becomes a page the
 * caller renders, a host rules line, a warning, or a delegated path for the
 * host's server, written through the caller's `write`.
 *
 * It imports no renderer and no filesystem, so it runs under any runtime.
 */

// Verdicts turned into files and host rules; the page body comes from the caller's render.
import { devGate } from '#dev-gate';

import { warnStrictSlash, warnUnclaimed } from './dev-warn.ts';
import { createServerRouter } from './index.ts';
import type { MountConfig, ServerRouter, Verdict } from './index.ts';

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
}

/**
 * Where {@link prerender} writes: over `node:fs`, a virtual fs, or memory.
 * `file` arrives with `outDir` already joined on, so a hook writes it
 * verbatim, creating its directory as needed.
 */
export type FileWriter = (file: string, body: string) => void | Promise<void>;

/** Options for {@link prerender}. */
export interface PrerenderOptions {
  /** The mount table, compiled here — or pass an already-compiled {@link PrerenderOptions.resolver | resolver}. */
  mounts?: Record<string, MountConfig>;
  /** A resolver from `createServerRouter`, instead of {@link PrerenderOptions.mounts | mounts}. */
  resolver?: ServerRouter;
  /** Every path to ask for a verdict. Redirect and notFound paths belong here too. */
  paths: Iterable<string> | AsyncIterable<string>;
  /** Directory the files are written under. */
  outDir: string;
  /**
   * Renders one shell verdict to the file's full text, document included.
   * Renders run one at a time, in enumeration order, then the 404 document.
   */
  render: (
    verdict: Extract<Verdict, { kind: 'shell' }>,
    context: RenderContext,
  ) => string | Promise<string>;
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
   * miss the rule. Shell verdicts need no rules line — they are written as
   * `<subpath>/index.html`, which both spellings reach — but a host that
   * reaches it by redirecting `<subpath>` to `<subpath>/` boots the client at
   * the slashed url, so the client's `strictMode(false)` and the mount's
   * `config: { strict: false }` must both admit it.
   */
  trailingSlash?: 'both' | 'exact';
  /** Writes each file; pass one over `node:fs`, a virtual fs, or memory. */
  write: FileWriter;
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
  /** Paths a delegating state's host handler answers — see {@link PrerenderResult.delegated}. */
  delegate: number;
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
  /**
   * Paths that matched a delegating state, in enumeration order: no page and
   * no rules line, since a host handler answers them. Route them to the
   * server, e.g. into Cloudflare's `assets.run_worker_first`.
   */
  delegated: string[];
}

type ShellVerdict = Extract<Verdict, { kind: 'shell' }>;

const DEFAULT_NOT_FOUND_FILE = '404.html';

// A path no route claims, appended to a mount base for the otherwise probe.
const PROBE_SEGMENT = '__ui-router-server-probe__';

const joinPath = (dir: string, file: string): string =>
  dir === '' ? file : `${dir.replace(/\/+$/, '')}/${file}`;

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

const wantsSlashProbe = (
  verdict: ShellVerdict,
  path: string,
  subpath: string,
): boolean =>
  subpath !== '' && verdict.status === undefined && !path.endsWith('/');

const redirectLines = (
  path: string,
  verdict: Extract<Verdict, { kind: 'redirect' }>,
  trailingSlash: PrerenderOptions['trailingSlash'],
): RedirectLine[] => {
  const line: RedirectLine = {
    from: path,
    to: verdict.location,
    status: verdict.status,
  };

  const paired = trailingSlash === 'both' ? otherSpelling(path) : undefined;

  return paired === undefined ? [line] : [line, { ...line, from: paired }];
};

// The otherwise projection's 404 shell, or undefined when there is none to emit.
const notFoundPage = async (
  notFound: PrerenderOptions['notFound'],
  mounts: PrerenderOptions['mounts'],
  resolver: ServerRouter,
) => {
  if (notFound === false) return undefined;
  const probe = notFound?.probe ?? defaultProbe(mounts);
  const verdict = await resolver.resolve(probe);

  if (verdict.kind !== 'shell' || verdict.status !== 404) return undefined;

  return { verdict, probe, file: notFound?.file ?? DEFAULT_NOT_FOUND_FILE };
};

const writeRules = async (
  lines: RedirectLine[],
  rules: NonNullable<PrerenderOptions['rules']>,
  write: FileWriter,
  outDir: string,
): Promise<void> => {
  if (rules === 'none') return;

  if (rules !== '_redirects') {
    await rules(lines);

    return;
  }

  if (lines.length === 0) return;

  const body = lines
    .map((line) => `${line.from} ${line.to} ${line.status}`)
    .join('\n');

  await write(joinPath(outDir, '_redirects'), `${body}\n`);
};

const resolverOf = (options: PrerenderOptions): ServerRouter => {
  if (options.resolver) return options.resolver;

  if (!options.mounts) {
    throw new Error(
      'prerender() needs a mount table: pass `mounts`, or a `resolver` from createServerRouter().',
    );
  }

  return createServerRouter({ mounts: options.mounts });
};

/**
 * Emits a static site from a mount table's verdicts: a shell verdict becomes
 * `<subpath>/index.html` holding whatever `render` returns, a redirect
 * becomes a rules line and no page, a delegating state is listed in
 * `delegated` and skipped, and the `otherwise` projection becomes the 404
 * document. A verdict kind this package doesn't know throws rather than being
 * counted.
 *
 * It knows no renderer: `render` turns each shell verdict into the file's
 * text, so any template engine, or a `settle` and a string, can fill it.
 * `lit-ui-router-ssr`'s `prerender` wraps this loop with a lit render.
 *
 * @param options - the mount table, the paths, the render, and the hooks
 * @returns what was emitted, planned or written
 * @throws an `Error` when neither `mounts` nor `resolver` is supplied
 * @throws an `Error` when the 404 document needs a default probe and only a `resolver` is supplied
 * @throws an `Error` when a path resolves to a verdict kind this package doesn't know
 *
 * @example
 * ```ts
 * import { mkdir, writeFile } from 'node:fs/promises';
 * import { dirname } from 'node:path';
 * import { prerender } from 'ui-router-server/prerender';
 * import { settle } from 'ui-router-server/ssr';
 *
 * const result = await prerender({
 *   mounts,
 *   outDir: 'dist',
 *   write: async (file, body) => {
 *     await mkdir(dirname(file), { recursive: true });
 *     await writeFile(file, body);
 *   },
 *   paths: ['/', '/sheet/7B', '/legacy'],
 *   render: async (verdict, { path }) => {
 *     await settle(router, path);
 *     return page(router);
 *   },
 * });
 * ```
 */
export async function prerender(
  options: PrerenderOptions,
): Promise<PrerenderResult> {
  const {
    mounts,
    paths,
    outDir,
    render,
    notFound,
    rules = '_redirects',
    extraRules = [],
    trailingSlash = 'both',
    write,
    dryRun = false,
  } = options;

  const resolver = resolverOf(options);

  const tally: PrerenderTally = {
    shell: 0,
    redirect: 0,
    notFound: 0,
    delegate: 0,
    document: 0,
  };

  const pages: EmittedPage[] = [];
  const generated: RedirectLine[] = [];
  const warnings: string[] = [];
  const delegated: string[] = [];

  const emit = async (
    verdict: ShellVerdict,
    path: string,
    subpath: string,
    file: string,
  ): Promise<void> => {
    const html = await render(verdict, { path, subpath, file });

    if (!dryRun) await write(joinPath(outDir, file), html);
    pages.push({
      path,
      file,
      verdict,
      bytes: new TextEncoder().encode(html).length,
    });
  };

  let slashProbed = false;

  const visit = async (path: string): Promise<void> => {
    const verdict = await resolver.resolve(path);
    // Read before narrowing: a structural resolver may return a kind the Verdict union lacks.
    const kind: string = verdict.kind;

    if (verdict.kind === 'shell') {
      const subpath = subpathIn(verdict.mount, path);
      tally.shell += 1;

      if (
        import.meta.env?.DEV &&
        devGate() &&
        !slashProbed &&
        wantsSlashProbe(verdict, path, subpath)
      ) {
        slashProbed = true;
        await warnStrictSlash(resolver, path);
      }

      await emit(verdict, path, subpath, fileFor(subpath));

      return;
    }

    if (verdict.kind === 'redirect') {
      tally.redirect += 1;
      generated.push(...redirectLines(path, verdict, trailingSlash));

      return;
    }

    if (verdict.kind === 'notFound') {
      tally.notFound += 1;
      warnings.push(path);
      warnUnclaimed(path);

      return;
    }

    if (kind !== 'delegate') {
      throw new Error(
        `prerender: '${path}' resolved to verdict kind '${kind}', which this ui-router-server does not know; upgrade it`,
      );
    }

    tally.delegate += 1;
    delegated.push(path);
  };

  for await (const path of paths) await visit(path);

  const page = await notFoundPage(notFound, mounts, resolver);

  if (page) {
    tally.document += 1;
    const { verdict, probe, file } = page;
    await emit(verdict, probe, subpathIn(verdict.mount, probe), file);
  }

  const lines = [...extraRules, ...generated];

  if (!dryRun) await writeRules(lines, rules, write, outDir);

  return { tally, pages, rules: lines, warnings, delegated };
}
