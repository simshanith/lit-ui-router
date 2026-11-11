// Starts Eleventy with `--base=` as its path prefix; Eleventy builds the app with Vite and writes the site into dist/.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

const args = process.argv.slice(2);

const base =
  args.find((arg) => arg.startsWith('--base='))?.slice('--base='.length) ?? '/';

rmSync('dist', { recursive: true, force: true });

const eleventy = spawn(
  'npx',
  [
    'eleventy',
    `--pathprefix=${base}`,
    ...(args.includes('--serve') ? ['--serve'] : []),
  ],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);

eleventy.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
