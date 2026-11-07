// Vite builds the server render module and the client; Eleventy then writes the site into dist/.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const base =
  process.argv
    .find((arg) => arg.startsWith('--base='))
    ?.slice('--base='.length) ?? '/';

const run = (args, env = {}) =>
  execFileSync('npx', args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });

run(['vite', 'build', '--ssr']);

run(['vite', 'build', `--base=${base}`]);

mkdirSync('node_modules/.build', { recursive: true });

writeFileSync('node_modules/.build/base.json', JSON.stringify(base));

run(['eleventy']);
