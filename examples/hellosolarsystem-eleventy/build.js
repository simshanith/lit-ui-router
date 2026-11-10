// Records the base path from `--base=`, then runs Eleventy, which builds the app with Vite and writes the site into dist/.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);

const base =
  args.find((arg) => arg.startsWith('--base='))?.slice('--base='.length) ?? '/';

rmSync('dist', { recursive: true, force: true });

mkdirSync('node_modules/.build', { recursive: true });

writeFileSync('node_modules/.build/base.json', JSON.stringify(base));

const eleventy = spawn(
  'npx',
  args.includes('--serve') ? ['eleventy', '--serve'] : ['eleventy'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

eleventy.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
