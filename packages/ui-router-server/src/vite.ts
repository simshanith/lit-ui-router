/**
 * The Vite plugin: the Connect adapter (see `./connect`) wired into Vite's
 * dev and preview middleware stacks, both of which are Connect-shaped. It is
 * the honest-status upgrade of Vite's built-in SPA fallback — `vite dev` and
 * `vite preview` answer the same 302s and mount-owned 404s the production
 * worker does, so a mounted app has dev/prod routing parity from one mounts
 * table.
 *
 * With {@link ServerRouterPluginOptions.prerender | prerender}, `vite build`
 * also emits the static site: after the client build it starts a
 * `worker_thread`, which loads the app's prerender script through a Vite
 * module runner of its own and hands it the output directory, the built
 * `index.html` and a writer over `node:fs`.
 *
 * Dependency-free like the tiers it fronts: the structural types below
 * declare the sliver of Vite's plugin surface the plugin touches, so Vite
 * stays a peer this package imports only lazily, inside the build step. The
 * returned object is a structural subset of Vite's `Plugin` — spread it
 * straight into `plugins: [...]`.
 */

import { nodeConditions } from '#node-conditions';

import { createConnectMiddleware } from './connect.ts';
import type {
  ConnectAdapterOptions,
  ConnectMiddleware,
  ConnectNext,
  ConnectRequest,
  ConnectResponse,
} from './connect.ts';
import type { ServerRouter, Verdict } from './index.ts';
import type { FileWriter, PrerenderResult } from './prerender.ts';
import type { PrerenderJob } from './prerender-thread.ts';
import { fileFor, subpathIn } from './site-paths.ts';

/** The sliver of Vite's dev/preview server the plugin uses: the Connect stack. */
export interface ViteMiddlewareServer {
  /** Vite's Connect stack; the plugin `use`s the adapter into it. */
  middlewares: {
    /** Appends middleware to the stack, in call order. */
    use(middleware: ConnectMiddleware): void;
  };
}

/** The sliver of Vite's resolved config the plugin reads. */
export interface ViteResolvedConfig {
  /** The project root; the prerender entry and `build.outDir` resolve against it. */
  root: string;
  /** `'build'` for `vite build`; the build step runs only then. */
  command: 'build' | 'serve';
  /** The mode, passed on to the module runner that loads the prerender entry. */
  mode: string;
  /** Build options: where the client build writes, and whether it is an SSR build. */
  build: {
    /** The client build's output directory, as configured. */
    outDir: string;
    /** Truthy for `vite build --ssr`, which the build step skips. */
    ssr: boolean | string;
  };
  /** Vite's logger; the build step reports what it wrote. */
  logger: {
    /** Logs one line at info level. */
    info(message: string): void;
  };
}

/** The sliver of Vite's plugin context the build step reads. */
export interface ViteBuildContext {
  /** The environment being built; the build step runs for `client` only. */
  environment?: {
    /** The environment's name. */
    name: string;
    /** The environment's own resolved config; under `buildApp` each environment has its own. */
    config: ViteResolvedConfig;
  };
}

/** What the plugin hands the prerender script's default export after `vite build`. */
export interface PrerenderBuild {
  /** Vite's resolved output directory, absolute. */
  outDir: string;
  /** The built `index.html` as a string, read before any page is written. */
  shellHtml: string;
  /** Writes a file over `node:fs`, creating its directory. */
  write: FileWriter;
}

/**
 * The prerender script's default export: calls a `prerender()` — this
 * package's from `ui-router-server/prerender`, or `lit-ui-router-ssr`'s —
 * with the build's values and returns its result. Spread `build` first to
 * let the script override any of them.
 */
export type PrerenderEntry = (
  build: PrerenderBuild,
) => PrerenderResult | Promise<PrerenderResult>;

/**
 * Types a prerender script's default export as a {@link PrerenderEntry}. It
 * returns `entry` unchanged, as Vite's `defineConfig` returns its config.
 *
 * @example
 * ```ts
 * export default definePrerender((site) => prerender({ ...site, mounts, paths, render }));
 * ```
 */
export function definePrerender(entry: PrerenderEntry): PrerenderEntry {
  return entry;
}

/** Options for {@link serverRouterPlugin}: the Connect adapter's, plus the build step. */
export interface ServerRouterPluginOptions extends ConnectAdapterOptions {
  /**
   * Prerenders the app after `vite build`. `entry` names the prerender
   * script, resolved against Vite's root, whose default export is a
   * {@link PrerenderEntry}; a string is shorthand for `{ entry }`. The script
   * runs in a `worker_thread` of its own, after any
   * {@link PrerenderOptions.preload | preload} modules, so nothing it installs
   * reaches Vite's process. It is loaded through a Vite module runner with
   * the root and mode, without the app's plugins, and its dependencies load
   * from node.
   *
   * `vite preview` then serves each page the build wrote, and `404.html` for
   * a path the `otherwise` rule sends to a 404 state, while redirects and
   * plain 404s still answer through the middleware. A
   * {@link ConnectAdapterOptions.serveShell | serveShell} passed here
   * replaces that.
   *
   * @see https://lit-ui-router.dev/guides/prerender-with-vite
   */
  prerender?: string | PrerenderOptions;
}

/** The object form of {@link ServerRouterPluginOptions.prerender}. */
export interface PrerenderOptions {
  /** The prerender entry module, such as `./src/prerender.ts`. */
  entry: string;
  /**
   * Modules the worker loads, in order, before the entry, such as a DOM shim
   * or a renderer's element registrations. A relative path resolves against
   * Vite's root; a bare specifier resolves as the entry's imports do.
   */
  preload?: readonly string[];
}

/** A structural subset of Vite's `Plugin` — assignable into `plugins: [...]`. */
export interface ServerRouterPlugin {
  /** The plugin name Vite reports in errors and logs. */
  name: string;
  /** Reads the root, the output directory and the logger. */
  configResolved(config: ViteResolvedConfig): void;
  /** Installs the middleware into `vite dev`, synchronously so it lands in the PRE position. */
  configureServer(server: ViteMiddlewareServer): void;
  /** Installs the same middleware into `vite preview`, serving the prerendered pages when there are any. */
  configurePreviewServer(server: ViteMiddlewareServer): void;
  /** Runs the prerender entry once the client build has written its output. */
  closeBundle: {
    /** After every other plugin's `closeBundle`. */
    order: 'post';
    /** Not alongside them. */
    sequential: true;
    /** The build step; a no-op without {@link ServerRouterPluginOptions.prerender | prerender}. */
    handler(this: ViteBuildContext, error?: Error): Promise<void>;
  };
}

type ShellVerdict = Extract<Verdict, { kind: 'shell' }>;

// Built at runtime so no node: or vite specifier enters the static module graph.
const NODE_FS = 'node:fs/promises';

const NODE_PATH = 'node:path';

const NODE_URL = 'node:url';

const NODE_WORKER_THREADS = 'node:worker_threads';

const PRERENDER_THREAD = '#prerender-thread';

const VITE = 'vite';

// Typed structurally so src never pulls in @types/node or vite.
interface NodeFsPromises {
  readFile(path: string, encoding: string): Promise<string>;
  stat(path: string): Promise<{ isFile(): boolean }>;
}

interface NodePath {
  resolve(...paths: string[]): string;
}

interface PrerenderWorker {
  on(event: 'message', listener: (result: PrerenderResult) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  on(event: 'exit', listener: (code: number) => void): void;
  terminate(): Promise<number>;
}

interface NodeWorkerThreads {
  Worker: new (
    filename: string,
    options: { workerData: PrerenderJob },
  ) => PrerenderWorker;
}

interface NodeUrl {
  fileURLToPath(url: string): string;
}

interface NodeImportMeta {
  resolve(specifier: string): string;
}

// SAFETY: the build step runs under node, whose `import.meta` has `resolve`.
const resolveHere = (specifier: string): string =>
  (import.meta as ImportMeta & NodeImportMeta).resolve(specifier);

// SAFETY: `NODE_FS` names `node:fs/promises`, whose members take these shapes.
const nodeFs = async () => (await import(NODE_FS)) as NodeFsPromises;

// SAFETY: `NODE_PATH` names `node:path`, whose `resolve` takes this shape.
const nodePath = async () => (await import(NODE_PATH)) as NodePath;

const NOT_FOUND_FILE = '404.html';

const fileUrl = (mount: string, file: string): string =>
  `${mount.replace(/\/+$/, '')}/${file}`;

// The emitted file for this shell, if the build wrote one; the mount's shell otherwise.
const previewShell =
  (
    config: () => ViteResolvedConfig | undefined,
    shellPath: (mount: string) => string,
  ) =>
  (
    mount: string,
    req: ConnectRequest,
    _res: ConnectResponse,
    next: ConnectNext,
    verdict: ShellVerdict,
  ): void => {
    const pathname = (req.url ?? '/').replace(/[?#].*$/, '');

    const file =
      verdict.status === undefined
        ? fileFor(subpathIn(mount, pathname))
        : NOT_FOUND_FILE;

    const resolved = config();

    const emitted = async (): Promise<boolean> => {
      if (resolved === undefined) return false;
      const [{ stat }, { resolve }] = await Promise.all([nodeFs(), nodePath()]);
      const { root, build } = resolved;

      return stat(resolve(root, build.outDir, file)).then(
        (stats) => stats.isFile(),
        () => false,
      );
    };

    emitted().then((found) => {
      req.url = found ? fileUrl(mount, file) : shellPath(mount);
      next();
    }, next);
  };

// SAFETY: `NODE_WORKER_THREADS` and `NODE_URL` name node's modules, whose members take these shapes.
const nodeWorker = async () =>
  (await Promise.all([import(NODE_WORKER_THREADS), import(NODE_URL)])) as [
    NodeWorkerThreads,
    NodeUrl,
  ];

// One thread per build: globals, registries and loader hooks the entry installs die with it.
const runInWorker = async (job: PrerenderJob): Promise<PrerenderResult> => {
  const [{ Worker }, { fileURLToPath }] = await nodeWorker();

  // A path, not a URL: under happy-dom the global URL is not node's.
  const worker = new Worker(fileURLToPath(resolveHere(PRERENDER_THREAD)), {
    workerData: job,
  });

  return new Promise<PrerenderResult>((resolve, reject) => {
    worker.on('message', (result) => {
      resolve(result);
      void worker.terminate();
    });
    // The worker's error arrives as a structured clone; `cause` carries it whole.
    worker.on('error', (error) => {
      reject(
        new Error(`serverRouterPlugin: prerender failed: ${error.message}`, {
          cause: error,
        }),
      );
    });
    worker.on('exit', (code) => {
      reject(
        new Error(
          `serverRouterPlugin: prerender worker exited with code ${String(code)} before it returned`,
        ),
      );
    });
  });
};

const summary = (result: PrerenderResult, outDir: string): string => {
  const delegated =
    result.delegated.length > 0
      ? `, ${String(result.delegated.length)} delegated paths left to the server`
      : '';

  return `ui-router-server/vite: prerendered ${String(result.pages.length)} files and ${String(result.rules.length)} rules into ${outDir}${delegated}`;
};

const runPrerender = async (
  { entry, preload = [] }: PrerenderOptions,
  config: ViteResolvedConfig,
): Promise<void> => {
  const [fs, path] = await Promise.all([nodeFs(), nodePath()]);
  const outDir = path.resolve(config.root, config.build.outDir);

  const shellHtml = await fs.readFile(
    path.resolve(outDir, 'index.html'),
    'utf8',
  );

  const result = await runInWorker({
    vite: resolveHere(VITE),
    root: config.root,
    mode: config.mode,
    conditions: nodeConditions(),
    entry: path.resolve(config.root, entry),
    preload,
    outDir,
    shellHtml,
  });

  if (result.warnings.length > 0)
    throw new Error(
      `serverRouterPlugin: prerender: no route matched ${result.warnings.join(', ')}`,
    );

  config.logger.info(summary(result, outDir));
};

/**
 * Wraps a {@link ServerRouter} as a Vite plugin. The middleware installs in the
 * PRE position — synchronously inside `configureServer`, before Vite adds
 * its own middlewares — which is exactly where `connect-history-api-fallback`
 * sits and the only position that beats Vite's always-200 HTML fallback: a
 * redirect answers 302 and a mount-owned miss answers 404 before Vite can
 * serve `index.html`. The adapter's `shouldHandle` still lets module and
 * asset fetches pass untouched, essential under Vite where a mount's module
 * URLs share paths with its routes.
 *
 * `serveShell` defaults to rewriting `req.url` to the mount base and
 * `next()`ing into Vite's HTML/transform layer (dev) or `sirv` (preview);
 * point {@link ConnectAdapterOptions.shellPath} at the mount's actual HTML entry
 * when it isn't served at the base.
 *
 * With {@link ServerRouterPluginOptions.prerender | prerender}, `vite build`
 * runs the entry after the client build and fails when a listed path matches
 * no route.
 *
 * @throws from the build step when the entry has no default export function,
 * the built `index.html` is missing, or a listed path matches no route
 *
 * @example
 * ```ts
 * plugins: [serverRouterPlugin(router, { prerender: { entry: './src/prerender.ts' } })],
 * ```
 */
export function serverRouterPlugin(
  router: ServerRouter,
  options: ServerRouterPluginOptions = {},
): ServerRouterPlugin {
  const { prerender, ...adapter } = options;

  const job =
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- the option's own union: a string is shorthand for `{ entry }`
    typeof prerender === 'string' ? { entry: prerender } : prerender;

  const middleware = createConnectMiddleware(router, adapter);
  let resolved: ViteResolvedConfig | undefined;

  const preview =
    job !== undefined && adapter.serveShell === undefined
      ? createConnectMiddleware(router, {
          ...adapter,
          serveShell: previewShell(
            () => resolved,
            adapter.shellPath ?? ((mount) => mount),
          ),
        })
      : middleware;

  return {
    name: 'ui-router-server',
    configResolved(config) {
      resolved = config;
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(preview);
    },
    closeBundle: {
      order: 'post',
      sequential: true,
      async handler(error) {
        const environment = this.environment;

        if (environment && environment.name !== 'client') return;
        // Under `buildApp`, `configResolved` last saw another environment's config.
        const config = environment?.config ?? resolved;

        if (job === undefined || !config || error) return;

        if (config.command !== 'build' || config.build.ssr) return;

        await runPrerender(job, config);
      },
    },
  };
}
