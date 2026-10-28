import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';

import { build, type Plugin as EsbuildPlugin } from 'esbuild';
import { rolldown, type Plugin as RolldownPlugin } from 'rolldown';

// One bundling seam for every probe: both legs normalize to this shape so
// callers assert the same contract under both bundlers' semantics.
export type Chunk = {
  name: string;
  code: string;
  bytes: number;
  entry: boolean;
  // sibling chunks only, under both bundlers; externals live in externalImports
  staticImports: string[];
  dynamicImports: string[];
  // bare specifiers this chunk statically imports from outside the bundle
  externalImports: string[];
};

// `file` is absolute when the bundler located the warning.
export type BundleWarning = { code: string; message: string; file?: string };

export type BundleResult = {
  entry: Chunk;
  chunks: Chunk[];
  inputs: string[];
  warnings: BundleWarning[];
};

// `external` takes bare package names; each leg widens them to subpaths.
// `annotations: false` ignores sideEffects/@__PURE__ hints while still
// shaking unused code — package sideEffects globs name dist/*.js, so probing
// src/*.ts would otherwise drop side-effect modules (and any undeclared
// import hiding in them).
// `define` feeds each bundler's build-time constant replacement, so a probe
// can measure the same folding the shipped build does (see @tools/oxc-emit).
// `alias` swaps a package and its subpaths for another install, resolved from
// `from` rather than the importer, the way a consumer's bundler alias does.
export type BundleOptions = {
  minify?: boolean;
  external?: string[];
  annotations?: boolean;
  define?: Record<string, string>;
  alias?: BundleAlias;
};

export type BundleAlias = { from: string; packages: Record<string, string> };

// The build-time constant @tools/oxc-emit folds in each emit pass. Probes that
// measure shipped size take the production value; probes that ask what the
// module graph contains take the development one, which is the larger graph.
export const PRODUCTION_DEFINE = {
  'import.meta.env.DEV': 'false',
} satisfies Record<string, string>;

export const DEVELOPMENT_DEFINE = {
  'import.meta.env.DEV': 'true',
} satisfies Record<string, string>;

export const bundlers = ['esbuild', 'rolldown'] as const;

export type Bundler = (typeof bundlers)[number];

const basename = (path: string): string => path.split('/').pop()!;

const escapeRegExp = (text: string): string =>
  text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

const finish = (
  chunks: Chunk[],
  inputs: string[],
  entryName: string,
  warnings: BundleWarning[],
): BundleResult => {
  const entry = chunks.find((chunk) => chunk.entry && chunk.name === entryName);

  if (!entry) throw new Error(`no ${entryName} entry chunk`);

  return { entry, chunks, inputs, warnings };
};

const aliasPattern = (name: string): RegExp =>
  new RegExp(`^${escapeRegExp(name)}(/|$)`);

const esbuildAlias = ({ from, packages }: BundleAlias): EsbuildPlugin => ({
  name: 'bundle-probe-alias',
  setup(build) {
    for (const [name, alias] of Object.entries(packages)) {
      build.onResolve({ filter: aliasPattern(name) }, async (args) => {
        const resolved = await build.resolve(
          alias + args.path.slice(name.length),
          { kind: args.kind, resolveDir: from },
        );

        return {
          path: resolved.path,
          namespace: resolved.namespace,
          external: resolved.external,
          sideEffects: resolved.sideEffects,
          errors: resolved.errors,
        };
      });
    }
  },
});

const rolldownAlias = ({ from, packages }: BundleAlias): RolldownPlugin => ({
  name: 'bundle-probe-alias',
  resolveId(source) {
    for (const [name, alias] of Object.entries(packages)) {
      if (!aliasPattern(name).test(source)) continue;

      return this.resolve(
        alias + source.slice(name.length),
        path.join(from, 'package.json'),
        { skipSelf: true },
      );
    }

    return null;
  },
});

const entryChunkName = (entryPath: string): string =>
  basename(entryPath).replace(/\.[^.]+$/, '.js');

const esbuildBundle = async (
  entryPath: string,
  {
    minify = false,
    external = [],
    annotations = true,
    define,
    alias,
  }: BundleOptions,
): Promise<BundleResult> => {
  const result = await build({
    entryPoints: [entryPath],
    bundle: true,
    format: 'esm',
    splitting: true,
    outdir: 'probe-out',
    write: false,
    metafile: true,
    minify,
    external: external.flatMap((name) => [name, `${name}/*`]),
    ignoreAnnotations: !annotations,
    define,
    plugins: alias ? [esbuildAlias(alias)] : [],
    logLevel: 'silent',
  });

  const outputs = Object.entries(result.metafile.outputs);

  const chunks = result.outputFiles.map((file): Chunk => {
    const name = basename(file.path);
    const [, meta] = outputs.find(([out]) => basename(out) === name)!;
    const internal = meta.imports.filter((edge) => !edge.external);

    return {
      name,
      code: file.text,
      bytes: file.contents.byteLength,
      entry: meta.entryPoint !== undefined,
      staticImports: internal
        .filter((edge) => edge.kind === 'import-statement')
        .map((edge) => basename(edge.path)),
      dynamicImports: internal
        .filter((edge) => edge.kind === 'dynamic-import')
        .map((edge) => basename(edge.path)),
      externalImports: meta.imports
        .filter((edge) => edge.external && edge.kind === 'import-statement')
        .map((edge) => edge.path),
    };
  });

  const warnings = result.warnings.map((warning): BundleWarning => ({
    code: warning.id,
    message: warning.text,
    file: warning.location ? path.resolve(warning.location.file) : undefined,
  }));

  return finish(
    chunks,
    Object.keys(result.metafile.inputs),
    entryChunkName(entryPath),
    warnings,
  );
};

const rolldownBundle = async (
  entryPath: string,
  {
    minify = false,
    external = [],
    annotations = true,
    define,
    alias,
  }: BundleOptions,
): Promise<BundleResult> => {
  const warnings: BundleWarning[] = [];

  const bundle = await rolldown({
    input: entryPath,
    external: external.map((name) => new RegExp(`^${escapeRegExp(name)}(/|$)`)),
    // treeshake:false, not a moduleSideEffects override: rolldown 1.2 still
    // honors the package sideEffects manifest under any treeshake object.
    treeshake: annotations,
    // rolldown takes `define` under `transform` (oxc's define plugin), not at
    // the top level — an unknown top-level key is only a warning.
    transform: define ? { define } : undefined,
    plugins: alias ? [rolldownAlias(alias)] : [],
    // collected, not printed: callers decide which warnings fail
    onLog: (level, log) => {
      if (level !== 'warn') return;

      // rolldown colors the message and prefixes it with `[CODE] `
      const message = stripVTControlCharacters(log.message).replace(
        /^\[\w+\] /,
        '',
      );

      warnings.push({ code: log.code ?? 'UNKNOWN', message, file: log.id });
    },
  });

  try {
    // comments:false mirrors esbuild's default comment stripping, so both
    // legs probe code, not comments.
    const { output } = await bundle.generate({
      format: 'esm',
      minify,
      comments: false,
    });

    const inputs = new Set<string>();
    const names = new Set<string>();

    for (const item of output) {
      if (item.type === 'chunk') names.add(item.fileName);
    }

    const chunks: Chunk[] = [];

    for (const item of output) {
      if (item.type !== 'chunk') continue;

      for (const id of item.moduleIds) inputs.add(id);
      // rollup's `imports` mixes sibling chunk names with external ids; split
      // them so both legs report the same two lists.
      chunks.push({
        name: item.fileName,
        code: item.code,
        bytes: Buffer.byteLength(item.code),
        entry: item.isEntry,
        staticImports: item.imports.filter((id) => names.has(id)),
        dynamicImports: [...item.dynamicImports],
        externalImports: item.imports.filter((id) => !names.has(id)),
      });
    }

    return finish(chunks, [...inputs], entryChunkName(entryPath), warnings);
  } finally {
    await bundle.close();
  }
};

export const bundleEntry = (
  entryPath: string,
  bundler: Bundler,
  options: BundleOptions = {},
): Promise<BundleResult> =>
  bundler === 'esbuild'
    ? esbuildBundle(entryPath, options)
    : rolldownBundle(entryPath, options);
