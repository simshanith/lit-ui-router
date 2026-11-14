// Bundles each subpath entry on its own and reports min and gzip sizes per chunk, with lit and @uirouter/core external.
import { rolldown } from 'rolldown';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const entries = [
  'index',
  'define',
  'plugin',
  'performance',
  'console',
  'testing',
];

const external = (id: string) =>
  id.startsWith('@uirouter/core') ||
  /^(lit|@lit\/|lit-html|lit-element)(\/|$)/.test(id);

const kb = (n: number) => (n / 1000).toFixed(1).padStart(5);

for (const entry of entries) {
  const input = fileURLToPath(new URL(`../src/${entry}.ts`, import.meta.url));

  const bundle = await rolldown({
    input,
    external,
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  });

  const { output } = await bundle.generate({ format: 'es', minify: true });

  // The first chunk is the entry; `with` chunks load with it, and `lazy` ones on demand, such as the Map on first use.
  for (const [index, chunk] of output.entries()) {
    if (chunk.type !== 'chunk') continue;

    const code = Buffer.from(chunk.code);
    const kind = chunk.isDynamicEntry ? 'lazy' : 'with';
    const name = index ? `  ${kind} ${chunk.name}` : entry;

    console.log(
      `${name.padEnd(12)} ${kb(code.length)} kB min  ${kb(gzipSync(code, { level: 9 }).length)} kB gzip`,
    );
  }
}
