/**
 * A static site from a mount table: each path's verdict becomes a page the
 * caller renders, a response state's body or rules line, a host rules line, a
 * warning, or a delegated path for the host's server, written through the
 * caller's `write`.
 *
 * It imports no renderer and no filesystem, so it runs under any runtime.
 */

// Verdicts turned into files and host rules; the page body comes from the caller's render.
import { devGate } from '#dev-gate';

import {
  baseFor,
  carriesBase,
  checkUndeclaredBase,
  mountsUnder,
  stripBase,
  withBase,
} from './base-path.ts';
import { warnStrictSlash, warnUnclaimed } from './dev-warn.ts';
import { createServerRouter } from './index.ts';
import type { MountConfig, ServerRouter, Verdict } from './index.ts';
import { redirectsFileBody } from './redirect-pages.ts';
import { fileFor, subpathIn } from './site-paths.ts';
import { mountPolicyOf, slashOf } from './trailing-slash.ts';
import type { TrailingSlash } from './trailing-slash.ts';

export { redirectPage, redirectPages } from './redirect-pages.ts';

export type { RedirectPagesOptions } from './redirect-pages.ts';

/** One emitted artefact, as {@link prerender} planned it. */
export interface EmittedPage {
  /** The requested path, exactly as the caller listed it. */
  path: string;
  /** Path relative to `outDir` — `sheet/7B/index.html`. */
  file: string;
  /** The verdict that produced it; `status` carries the otherwise projection's 404. */
  verdict: Verdict;
  /** Status the page answers with, as the adapters answer the same path. */
  readonly status: number;
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

/**
 * A render's answer in place of a page: the path redirects, written as a
 * rules line like a redirect verdict's.
 */
export interface RenderedRedirect {
  /** Target path, host-absolute, or an absolute url. */
  location: string;
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

/** What a {@link RulesWriter} is handed besides the lines. */
export interface RulesContext {
  /** The run's {@link PrerenderOptions.write | write}; files take `outDir` joined on. */
  write: FileWriter;
  /** The run's {@link PrerenderOptions.outDir | outDir}. */
  outDir: string;
  /** The run's {@link PrerenderOptions.base | base}, already on every generated line. */
  base: string;
  /** Every page the run wrote, the 404 document included. */
  pages: readonly EmittedPage[];
}

/**
 * A {@link PrerenderOptions.rules | `rules`} function: receives every rules
 * line once the pages are written, and writes whatever the host reads.
 */
export type RulesWriter = (
  lines: RedirectLine[],
  context: RulesContext,
) => void | Promise<void>;

/** Options for {@link prerender}. */
export interface PrerenderOptions {
  /** The mount table, compiled here — or pass an already-compiled {@link PrerenderOptions.resolver | resolver}. */
  mounts?: Record<string, MountConfig>;
  /**
   * A resolver from `createServerRouter`, instead of
   * {@link PrerenderOptions.mounts | mounts}; its mounts' trailing-slash
   * policies come with it. Any other resolver is read as `'as-requested'`.
   */
  resolver?: ServerRouter;
  /**
   * Every path to ask for a verdict. Redirect and notFound paths belong here
   * too. They spell the {@link PrerenderOptions.base | base} when
   * {@link PrerenderOptions.pathsIncludeBase | pathsIncludeBase} is on, as
   * it is by default for a router that declares one, and lie under it with
   * it taken off otherwise.
   */
  paths: Iterable<string> | AsyncIterable<string>;
  /**
   * Whether each of {@link PrerenderOptions.paths | paths} spells the
   * {@link PrerenderOptions.base | base}, as a host serves it: `/app/about`
   * under `/app/`. When `true`, the base is taken off each path once,
   * before anything else sees it, so the output matches the base-free
   * listing; a path outside the base throws. When `false`, a path is read as
   * given, even one that starts with the base. `pages`, `warnings` and
   * `delegated` report each path as listed. Under base `/` it changes nothing.
   *
   * Defaults to whether the router declares a base: `true` for a
   * {@link PrerenderOptions.resolver | resolver} from
   * `createServerRouter({ base, mounts })` or a
   * {@link PrerenderOptions.mounts | mounts} table keyed by the base, so a
   * table that spells real urls lists real urls; `false` for a table at `/`
   * stripped under a `base`, so its paths stay the same at any base. The
   * default follows that declaration, never the shape of the paths.
   */
  pathsIncludeBase?: boolean;
  /** Directory the files are written under. */
  outDir: string;
  /**
   * The url path `outDir` is served at, such as Vite's `base`; `/` by
   * default. The mounts stay at `/` and page files don't move: the base goes
   * once onto each generated rules line's `from` and host-absolute `to`.
   * {@link PrerenderOptions.extraRules | extraRules} are written as given.
   * Defaults to the {@link PrerenderOptions.resolver | resolver}'s own
   * `base`; a different value throws, as does a relative or full-URL base.
   * A {@link PrerenderOptions.mounts | mounts} table keyed by the base
   * compiles as `createServerRouter({ base, mounts })` would. Either way,
   * {@link PrerenderOptions.paths | paths} lie under the base, with it taken
   * off.
   */
  base?: string;
  /**
   * Renders one shell verdict to the file's full text, document included, or
   * answers a {@link RenderedRedirect} for a page whose render found it
   * redirects, such as a `redirectTo` function `settle` followed: the path
   * gets a rules line and no page. Renders run one at a time, in enumeration
   * order, then the 404 document, which must render a page.
   */
  render: (
    verdict: Extract<Verdict, { kind: 'shell' }>,
    context: RenderContext,
  ) => string | RenderedRedirect | Promise<string | RenderedRedirect>;
  /**
   * Answers one response verdict: settle the state and run the handler bound
   * to its name. A 2xx answer's body, read as text, is written to the path
   * its url spells (`badge.svg`; `index.html` at the mount root), its headers
   * dropped; a 3xx becomes a rules line to its `Location`; any other status
   * throws. Runs in the same sequence as `render`. `lit-ui-router-ssr`'s
   * `prerender` supplies it from the handlers bound by state name.
   */
  respond?: (
    verdict: ResponseVerdict,
    context: RenderContext,
  ) => Response | Promise<Response>;
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
   * caller; a function receives the lines and writes whatever the host reads,
   * such as `redirectPages` for a host with no redirect rules.
   * No SPA catch-all is ever written — one turns every 404 into a 200.
   */
  rules?: '_redirects' | 'none' | RulesWriter;
  /** Lines prepended to the generated ones, verbatim — a site's own legacy redirects. */
  extraRules?: RedirectLine[];
  /** Writes each file; pass one over `node:fs`, a virtual fs, or memory. */
  write: FileWriter;
  /** Plans everything and writes nothing — neither pages nor the rules file. */
  dryRun?: boolean;
}

/** Counts of what {@link prerender} emitted. */
export interface PrerenderTally {
  /** Shell verdicts written as `<subpath>/index.html`. */
  shell: number;
  /**
   * Redirect verdicts, and shell verdicts whose render answered a redirect,
   * counted once each however many rules lines they produced.
   */
  redirect: number;
  /** Paths that matched nothing — see {@link PrerenderResult.warnings}. */
  notFound: number;
  /** Paths a delegating state's host handler answers — see {@link PrerenderResult.delegated}. */
  delegate: number;
  /** Response states, written as their body or a rules line, counted once each. */
  response: number;
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

type ResponseVerdict = Extract<Verdict, { kind: 'response' }>;

const DEFAULT_NOT_FOUND_FILE = '404.html';

const isPage = (rendered: string | RenderedRedirect): rendered is string =>
  typeof rendered === 'string';

// A path no route claims, appended to a mount base for the otherwise probe.
const PROBE_SEGMENT = '__ui-router-server-probe__';

const joinPath = (dir: string, file: string): string =>
  dir === '' ? file : `${dir.replace(/\/+$/, '')}/${file}`;

// The response body's file: the subpath as spelled, or 'index.html' at the mount root.
const responseFileFor = (subpath: string): string =>
  subpath.replace(/^\/+/, '').replace(/\/+$/, '') || 'index.html';

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

// The line from path, paired with its other spelling unless that is the target itself.
const redirectLines = (
  path: string,
  { location, status }: { location: string; status: number },
): RedirectLine[] => {
  const line: RedirectLine = { from: path, to: location, status };
  const paired = otherSpelling(path);

  return paired === undefined || paired === location
    ? [line]
    : [line, { ...line, from: paired }];
};

// The spelling the verdict's mount policy gives its kind of state.
const slashFor = (
  resolver: ServerRouter,
  verdict: ShellVerdict | ResponseVerdict,
): TrailingSlash =>
  slashOf(
    verdict.kind === 'response' ? { response: true } : {},
    mountPolicyOf(resolver, verdict.mount),
  );

// The server's redirect from path's other spelling onto path, when the policy respells it.
const respelledLines = async (
  resolver: ServerRouter,
  path: string,
  slash: TrailingSlash,
): Promise<RedirectLine[]> => {
  const other = slash === 'as-requested' ? undefined : otherSpelling(path);

  if (other === undefined) return [];
  const verdict = await resolver.resolve(other);

  return verdict.kind === 'redirect' && verdict.location === path
    ? [{ from: other, to: path, status: verdict.status }]
    : [];
};

const lineKey = ({ from, to, status }: RedirectLine): string =>
  `${from} ${to} ${status}`;

// Drops repeats of a line, as a page and a listed respelling of it both write it.
const uniqueLines = (lines: RedirectLine[]): RedirectLine[] => {
  const seen = new Set<string>();

  return lines.filter((line) => {
    const key = lineKey(line);

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
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
  context: RulesContext,
): Promise<void> => {
  if (rules === 'none') return;

  if (rules !== '_redirects') {
    await rules(lines, context);

    return;
  }

  if (lines.length === 0) return;

  await context.write(
    joinPath(context.outDir, '_redirects'),
    redirectsFileBody(lines),
  );
};

// Whether a mounts table spells the base in its keys, and so compiles under it.
const keyedBy = (base: string, mounts: Record<string, MountConfig>): boolean =>
  Object.keys(mounts).some((key) => carriesBase(base, key));

const resolverOf = (
  options: PrerenderOptions,
  base: string | undefined,
): ServerRouter => {
  if (options.resolver) return options.resolver;

  if (!options.mounts) {
    throw new Error(
      'prerender() needs a mount table: pass `mounts`, or a `resolver` from createServerRouter().',
    );
  }

  return createServerRouter({ base, mounts: options.mounts });
};

/**
 * Emits a static site from a mount table's verdicts: a shell verdict becomes
 * `<subpath>/index.html` holding whatever `render` returns, or a rules line
 * when `render` answers a {@link RenderedRedirect}, a response
 * state becomes the body or rules line its `respond` answer carries, a
 * redirect becomes a rules line and no page, a delegating state is listed in
 * `delegated` and skipped, and the `otherwise` projection becomes the 404
 * document. A verdict kind this package doesn't know throws rather than being
 * counted.
 *
 * Rules lines follow each mount's `config.trailingSlash` policy. Where it
 * spells a page or a response state `'always'` or `'never'`, the output
 * lands at the path listed and the other spelling gets the `308` line onto
 * it that the server answers; list each path in its canonical spelling, as
 * `href()` formats it under {@link url-config!applyUrlConfig | `applyUrlConfig`}.
 * Under `'as-requested'` neither spelling gets a line. A redirect's line is
 * written for both spellings of its path, since a static host may append the
 * slash. Under a {@link PrerenderOptions.base | base}, every generated line
 * carries it.
 *
 * It knows no renderer: `render` turns each shell verdict into the file's
 * text, so any template engine, or a `settle` and a string, can fill it.
 * `lit-ui-router-ssr`'s `prerender` wraps this loop with a lit render.
 *
 * @param options - the mount table, the paths, the render, and the hooks
 * @returns what was emitted, planned or written
 * @throws an `Error` when neither `mounts` nor `resolver` is supplied
 * @throws an `Error` when `base` is relative or a full URL, or differs from the resolver's
 * @throws an `Error` when a mount of a resolver that declares no `base` already carries `base`
 * @throws an `Error` when the 404 document needs a default probe and only a `resolver` is supplied
 * @throws an `Error` when a path resolves to a verdict kind this package doesn't know
 * @throws an `Error` when the 404 document's render answers a redirect
 * @throws an `Error` when a path matches a response state and no `respond` is supplied, or its answer is neither a 2xx nor a 3xx with a `Location`
 *
 * @example
 * ```ts
 * import type { UIRouter } from '@uirouter/core';
 * import { mkdir, writeFile } from 'node:fs/promises';
 * import { dirname } from 'node:path';
 * import { prerender, type PrerenderOptions } from 'ui-router-server/prerender';
 * import { settle } from 'ui-router-server/ssr';
 *
 * declare const mounts: PrerenderOptions['mounts'];
 * declare const router: UIRouter;
 * declare function page(router: UIRouter): string;
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
    respond,
    notFound,
    rules = '_redirects',
    extraRules = [],
    write,
    dryRun = false,
  } = options;

  const base = baseFor(options.resolver ?? {}, options.base, 'prerender');
  const keyed = mounts !== undefined && keyedBy(base, mounts);
  const resolver = resolverOf(options, keyed ? base : undefined);
  await checkUndeclaredBase(resolver, base, 'prerender');

  const pathsIncludeBase =
    options.pathsIncludeBase ?? resolver.base !== undefined;

  const tally: PrerenderTally = {
    shell: 0,
    redirect: 0,
    notFound: 0,
    delegate: 0,
    response: 0,
    document: 0,
  };

  const pages: EmittedPage[] = [];
  const generated: RedirectLine[] = [];
  const warnings: string[] = [];
  const delegated: string[] = [];

  // Whether the render wrote a page or answered a redirect.
  const emit = async (
    verdict: ShellVerdict,
    path: string,
    subpath: string,
    file: string,
    listed = path,
  ): Promise<'shell' | 'redirect'> => {
    const html = await render(verdict, { path, subpath, file });

    if (!isPage(html)) {
      generated.push(...redirectLines(path, html));

      return 'redirect';
    }

    if (!dryRun) await write(joinPath(outDir, file), html);
    pages.push({
      path: listed,
      file,
      verdict,
      status: verdict.status ?? 200,
      bytes: new TextEncoder().encode(html).length,
    });

    return 'shell';
  };

  const answer = async (
    verdict: ResponseVerdict,
    path: string,
    listed: string,
  ): Promise<void> => {
    const subpath = subpathIn(verdict.mount, path);
    const file = responseFileFor(subpath);

    if (respond === undefined)
      throw new Error(
        `prerender: '${path}' matched response state '${verdict.state}'; pass \`respond\` to answer it`,
      );
    const response = await respond(verdict, { path, subpath, file });
    const { status } = response;
    const location = response.headers.get('Location');
    tally.response += 1;

    if (status >= 300 && status < 400 && location !== null) {
      generated.push(...redirectLines(path, { location, status }));

      return;
    }

    if (status < 200 || status >= 300)
      throw new Error(
        `prerender: response state '${verdict.state}' answered '${path}' with ${status}, which a static host cannot serve`,
      );
    const body = await response.text();

    if (!dryRun) await write(joinPath(outDir, file), body);
    pages.push({
      path: listed,
      file,
      verdict,
      status,
      bytes: new TextEncoder().encode(body).length,
    });
    generated.push(
      ...(await respelledLines(resolver, path, slashFor(resolver, verdict))),
    );
  };

  let slashProbed = false;

  // The listed path as the mounts see it: the base taken off once, when the caller listed it on.
  const baseFree = (listed: string): string => {
    if (!pathsIncludeBase) return listed;
    const path = stripBase(base, listed);

    if (path === undefined)
      throw new Error(
        `prerender: '${listed}' lies outside base '${base}', and pathsIncludeBase lists every path under it`,
      );

    return path;
  };

  const visit = async (listed: string): Promise<void> => {
    const path = baseFree(listed);
    const verdict = await resolver.resolve(path);
    // Read before narrowing: a structural resolver may return a kind the Verdict union lacks.
    const kind: string = verdict.kind;

    if (verdict.kind === 'shell') {
      const subpath = subpathIn(verdict.mount, path);
      const slash = slashFor(resolver, verdict);

      if (
        import.meta.env?.DEV &&
        devGate() &&
        !slashProbed &&
        slash === 'as-requested' &&
        wantsSlashProbe(verdict, path, subpath)
      ) {
        slashProbed = true;
        await warnStrictSlash(resolver, path);
      }

      const emitted = await emit(
        verdict,
        path,
        subpath,
        fileFor(subpath),
        listed,
      );

      tally[emitted] += 1;

      if (emitted === 'shell')
        generated.push(...(await respelledLines(resolver, path, slash)));

      return;
    }

    if (verdict.kind === 'redirect') {
      tally.redirect += 1;
      generated.push(...redirectLines(path, verdict));

      return;
    }

    if (verdict.kind === 'response') {
      await answer(verdict, path, listed);

      return;
    }

    if (verdict.kind === 'notFound') {
      tally.notFound += 1;
      warnings.push(listed);
      warnUnclaimed(listed);

      return;
    }

    if (kind !== 'delegate') {
      throw new Error(
        `prerender: '${path}' resolved to verdict kind '${kind}', which this ui-router-server does not know; upgrade it`,
      );
    }

    tally.delegate += 1;
    delegated.push(listed);
  };

  for await (const path of paths) await visit(path);

  const page = await notFoundPage(
    notFound,
    keyed ? mountsUnder(base, mounts, 'prerender') : mounts,
    resolver,
  );

  if (page) {
    tally.document += 1;
    const { verdict, probe, file } = page;

    if (
      (await emit(verdict, probe, subpathIn(verdict.mount, probe), file)) !==
      'shell'
    )
      throw new Error(
        `prerender: the 404 document's render for '${probe}' answered a redirect; it must render a page`,
      );
  }

  const lines = [
    ...extraRules,
    ...uniqueLines(generated).map((line) => ({
      ...line,
      from: withBase(base, line.from),
      to: withBase(base, line.to),
    })),
  ];

  if (!dryRun) await writeRules(lines, rules, { write, outDir, base, pages });

  return { tally, pages, rules: lines, warnings, delegated };
}
