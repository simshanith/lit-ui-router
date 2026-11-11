// Bundles each subpath entry on its own and reports min and gzip sizes, with lit and @uirouter/core external.
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
  const code = Buffer.from(output[0].code);
  console.log(
    `${entry.padEnd(12)} ${kb(code.length)} kB min  ${kb(gzipSync(code, { level: 9 }).length)} kB gzip`,
  );
}
