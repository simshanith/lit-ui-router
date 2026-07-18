import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';
import { rolldown } from 'rolldown';

// One bundling seam for every probe: both legs normalize to this shape so the
// treeshake and size suites assert the same contract under both bundlers.
export type Chunk = {
  name: string;
  code: string;
  bytes: number;
  entry: boolean;
  staticImports: string[];
  dynamicImports: string[];
};

export type BundleResult = { entry: Chunk; chunks: Chunk[]; inputs: string[] };

export type BundleOptions = { minify?: boolean; external?: string[] };

export const bundlers = ['esbuild', 'rolldown'] as const;
export type Bundler = (typeof bundlers)[number];

const src = (entry: string): string =>
  fileURLToPath(new URL(`../src/${entry}`, import.meta.url));

const basename = (path: string): string => path.split('/').pop()!;

const finish = (
  chunks: Chunk[],
  inputs: string[],
  entryName: string,
): BundleResult => {
  const entry = chunks.find((chunk) => chunk.entry && chunk.name === entryName);
  if (!entry) throw new Error(`no ${entryName} entry chunk`);
  return { entry, chunks, inputs };
};

const esbuildBundle = async (
  entry: string,
  { minify = false, external = [] }: BundleOptions,
): Promise<BundleResult> => {
  const result = await build({
    entryPoints: [src(entry)],
    bundle: true,
    format: 'esm',
    splitting: true,
    outdir: 'probe-out',
    write: false,
    metafile: true,
    minify,
    external,
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
    entry.replace(/\.ts$/, '.js'),
  );
};

const rolldownBundle = async (
  entry: string,
  { minify = false, external = [] }: BundleOptions,
): Promise<BundleResult> => {
  const bundle = await rolldown({
    input: src(entry),
    external,
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
    return finish(chunks, [...inputs], entry.replace(/\.ts$/, '.js'));
  } finally {
    await bundle.close();
  }
};

export const bundleEntry = (
  entry: string,
  bundler: Bundler,
  options: BundleOptions = {},
): Promise<BundleResult> =>
  bundler === 'esbuild'
    ? esbuildBundle(entry, options)
    : rolldownBundle(entry, options);
