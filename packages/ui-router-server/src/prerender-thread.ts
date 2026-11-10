/**
 * The prerender worker: `serverRouterPlugin` starts one `worker_thread` here
 * per build, so whatever the entry and its preloads install (globals, a
 * custom element registry, loader hooks) dies with the thread instead of
 * staying in Vite's process. It loads the preloads and then the entry
 * through a Vite module runner of its own, calls the entry with the build's
 * values and posts the {@link PrerenderResult} back.
 *
 * @internal
 */

import type { FileWriter, PrerenderResult } from './prerender.ts';
import type { PrerenderEntry } from './vite.ts';

/** What the plugin hands the worker as `workerData`. */
export interface PrerenderJob {
  /** The URL of the `vite` the plugin itself resolved. */
  vite: string;
  /** Vite's root. */
  root: string;
  /** Vite's mode. */
  mode: string;
  /** The `--conditions` node runs with. */
  conditions: string[];
  /** The prerender entry, absolute. */
  entry: string;
  /** Modules to load, in order, before the entry. */
  preload: readonly string[];
  /** Vite's resolved output directory, absolute. */
  outDir: string;
  /** The built `index.html`. */
  shellHtml: string;
}

// Built at runtime so no node: specifier enters the static module graph.
const NODE_WORKER_THREADS = 'node:worker_threads';

const NODE_FS = 'node:fs/promises';

const NODE_PATH = 'node:path';

const NODE_PROCESS = 'node:process';

// Typed structurally so src never pulls in @types/node or vite.
interface NodeWorkerThreads {
  parentPort: { postMessage(value: PrerenderResult): void } | null;
  workerData: PrerenderJob;
}

interface NodeFsPromises {
  mkdir(
    path: string,
    options: { recursive: boolean },
  ): Promise<string | undefined>;
  writeFile(path: string, data: string, encoding: string): Promise<void>;
}

interface OutputStream {
  write(chunk: string, callback: () => void): boolean;
}

interface NodeProcess {
  stdout: OutputStream;
  stderr: OutputStream;
}

interface NodePath {
  dirname(path: string): string;
  isAbsolute(path: string): boolean;
  resolve(...paths: string[]): string;
}

// The config runnerImport resolves: one server environment that externalizes every dependency.
interface RunnerConfig {
  root: string;
  mode: string;
  configFile: false;
  logLevel: 'warn';
  environments: Record<
    string,
    {
      consumer: 'server';
      dev: { moduleRunnerTransform: true };
      resolve: {
        external: true;
        mainFields: string[];
        conditions: string[];
        externalConditions: string[];
      };
    }
  >;
}

// Opaque here: only handed back to createRunnableDevEnvironment.
interface ResolvedRunnerConfig {
  root: string;
}

interface RunnerContext {
  runnerOptions: { hmr: { logger: false } };
  hot: false;
}

interface RunnableEnvironment {
  init(): Promise<void>;
  close(): Promise<void>;
  runner: { import(url: string): Promise<{ default?: PrerenderEntry }> };
}

// The environment runnerImport builds, kept open until the entry's prerender() returns.
interface ViteRunnerApi {
  resolveConfig(
    inlineConfig: RunnerConfig,
    command: 'serve',
  ): Promise<ResolvedRunnerConfig>;
  createRunnableDevEnvironment(
    name: string,
    config: ResolvedRunnerConfig,
    context: RunnerContext,
  ): RunnableEnvironment;
}

// Vite's default `resolve.externalConditions`.
const EXTERNAL_CONDITIONS = ['node', 'module-sync'];

const RUNNER = 'ui_router_server_prerender';

// Every dependency loads from node, as under `node entry.ts`; only the app's own modules go through Vite.
const runJob = async (job: PrerenderJob): Promise<PrerenderResult> => {
  // SAFETY: these specifiers name node's own modules and the plugin's `vite`, which take these shapes on the peer range.
  const [fs, path, vite] = (await Promise.all([
    import(NODE_FS),
    import(NODE_PATH),
    import(job.vite),
  ])) as [NodeFsPromises, NodePath, ViteRunnerApi];

  const resolved = await vite.resolveConfig(
    {
      root: job.root,
      mode: job.mode,
      configFile: false,
      logLevel: 'warn',
      environments: {
        [RUNNER]: {
          consumer: 'server',
          dev: { moduleRunnerTransform: true },
          // Externals resolve with node's own `--conditions`, so node's imports and the runner's share one copy of each dependency.
          resolve: {
            external: true,
            mainFields: [],
            conditions: ['node', ...job.conditions],
            externalConditions: [...EXTERNAL_CONDITIONS, ...job.conditions],
          },
        },
      },
    },
    'serve',
  );

  const environment = vite.createRunnableDevEnvironment(RUNNER, resolved, {
    runnerOptions: { hmr: { logger: false } },
    hot: false,
  });

  const local = (id: string): string =>
    id.startsWith('.') || path.isAbsolute(id) ? path.resolve(job.root, id) : id;

  const write: FileWriter = async (file, body) => {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body, 'utf8');
  };

  await environment.init();

  try {
    for (const id of job.preload) await environment.runner.import(local(id));

    const { default: entry } = await environment.runner.import(job.entry);

    if (!(entry instanceof Function))
      throw new Error(
        `prerender entry '${job.entry}' has no default export function`,
      );

    return await entry({
      outDir: job.outDir,
      shellHtml: job.shellHtml,
      write,
    });
  } finally {
    await environment.close();
  }
};

// SAFETY: `NODE_WORKER_THREADS` and `NODE_PROCESS` name node's modules, whose members take these shapes; the plugin passes a PrerenderJob as workerData.
const [{ parentPort, workerData }, { stdout, stderr }] = (await Promise.all([
  import(NODE_WORKER_THREADS),
  import(NODE_PROCESS),
])) as [NodeWorkerThreads, NodeProcess];

const drained = (stream: OutputStream): Promise<void> =>
  new Promise((resolve) => stream.write('', () => resolve()));

const flush = (): Promise<[void, void]> =>
  Promise.all([drained(stdout), drained(stderr)]);

const run = runJob(workerData);

// The plugin terminates the thread on the result, so the parent must take every write first, on either outcome.
await run.then(flush, flush);

parentPort?.postMessage(await run);
