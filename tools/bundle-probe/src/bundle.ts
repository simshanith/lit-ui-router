import { build } from 'esbuild';
import { rolldown } from 'rolldown';

// One bundling seam for every probe: both legs normalize to this shape so
// callers assert the same contract under both bundlers' semantics.
export type Chunk = {
  name: string;
  code: string;
  bytes: number;
  entry: boolean;
  staticImports: string[];
  dynamicImports: string[];
};

export type BundleResult = { entry: Chunk; chunks: Chunk[]; inputs: string[] };

// `external` takes bare package names; each leg widens them to subpaths.
// `annotations: false` ignores sideEffects/@__PURE__ hints while still
// shaking unused code — package sideEffects globs name dist/*.js, so probing
// src/*.ts would otherwise drop side-effect modules (and any undeclared
// import hiding in them).
export type BundleOptions = {
  minify?: boolean;
  external?: string[];
  annotations?: boolean;
};

export const bundlers = ['esbuild', 'rolldown'] as const;
export type Bundler = (typeof bundlers)[number];

const basename = (path: string): string => path.split('/').pop()!;

const escapeRegExp = (text: string): string =>
  text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

const finish = (
  chunks: Chunk[],
  inputs: string[],
  entryName: string,
): BundleResult => {
  const entry = chunks.find((chunk) => chunk.entry && chunk.name === entryName);
  if (!entry) throw new Error(`no ${entryName} entry chunk`);
  return { entry, chunks, inputs };
};

const entryChunkName = (entryPath: string): string =>
  basename(entryPath).replace(/\.[^.]+$/, '.js');

const esbuildBundle = async (
  entryPath: string,
  { minify = false, external = [], annotations = true }: BundleOptions,
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
    };
  });
  return finish(
    chunks,
    Object.keys(result.metafile.inputs),
    entryChunkName(entryPath),
  );
};

const rolldownBundle = async (
  entryPath: string,
  { minify = false, external = [], annotations = true }: BundleOptions,
): Promise<BundleResult> => {
  const bundle = await rolldown({
    input: entryPath,
    external: external.map((name) => new RegExp(`^${escapeRegExp(name)}(/|$)`)),
    // treeshake:false, not a moduleSideEffects override: rolldown 1.2 still
    // honors the package sideEffects manifest under any treeshake object.
    treeshake: annotations,
    logLevel: 'silent',
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
    const chunks: Chunk[] = [];
    for (const item of output) {
      if (item.type !== 'chunk') continue;
      for (const id of item.moduleIds) inputs.add(id);
      chunks.push({
        name: item.fileName,
        code: item.code,
        bytes: Buffer.byteLength(item.code),
        entry: item.isEntry,
        staticImports: [...item.imports],
        dynamicImports: [...item.dynamicImports],
      });
    }
    return finish(chunks, [...inputs], entryChunkName(entryPath));
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
