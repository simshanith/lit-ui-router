// Vite builds the server render module and the client; Eleventy then writes the site into dist/.
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);

const base =
  args.find((arg) => arg.startsWith('--base='))?.slice('--base='.length) ?? '/';

const run = (cmd) =>
  new Promise((resolve, reject) => {
    const child = spawn('npx', cmd, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`npx ${cmd.join(' ')} exited ${code}`)),
    );
  });

rmSync('dist', { recursive: true, force: true });

await run(['vite', 'build', '--ssr']);

await run(['vite', 'build', `--base=${base}`]);

mkdirSync('node_modules/.build', { recursive: true });

writeFileSync('node_modules/.build/base.json', JSON.stringify(base));

await run(args.includes('--serve') ? ['eleventy', '--serve'] : ['eleventy']);
