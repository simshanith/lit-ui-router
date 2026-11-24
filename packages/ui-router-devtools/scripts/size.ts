// Bundles each subpath entry on its own and reports min and gzip sizes per chunk, with lit and @uirouter/core external.
import { rolldown } from 'rolldown';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import packageJson from '../package.json' with { type: 'json' };

const entries = [
  'index',
  'define',
  'plugin',
  'lazy',
  'performance',
  'console',
  'testing',
  'lit-ui-router',
];

const external = (id: string) =>
  id.startsWith('@uirouter/core') ||
  /^(lit|@lit\/|lit-html|lit-element)(\/|$)/.test(id);

// sideEffects names dist/ files; these are their sources, which would otherwise shake away.
const effects = new Set(
  packageJson.sideEffects.map((file) =>
    fileURLToPath(
      new URL(
        file.replace('./dist/', '../src/').replace(/\.js$/, '.ts'),
        import.meta.url,
      ),
    ),
  ),
);

const kb = (n: number) => (n / 1000).toFixed(1).padStart(5);

for (const entry of entries) {
  const input = fileURLToPath(new URL(`../src/${entry}.ts`, import.meta.url));

  const bundle = await rolldown({
    input,
    external,
    treeshake: { moduleSideEffects: (id) => effects.has(id) || undefined },
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  });

  const { output } = await bundle.generate({ format: 'es', minify: true });

  const chunks = output.filter((chunk) => chunk.type === 'chunk');
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  // `with` chunks are the entry's static imports, which load with it; the rest load on demand, such as the Map on first use.
  const eager = new Set([chunks[0].fileName]);

  for (const file of eager)
    for (const imported of byFile.get(file)?.imports ?? []) eager.add(imported);

  for (const [index, chunk] of chunks.entries()) {
    const code = Buffer.from(chunk.code);
    const kind = eager.has(chunk.fileName) ? 'with' : 'lazy';
    const name = index ? `  ${kind} ${chunk.name}` : entry;

    console.log(
      `${name.padEnd(12)} ${kb(code.length)} kB min  ${kb(gzipSync(code, { level: 9 }).length)} kB gzip`,
    );
  }
}
