#!/usr/bin/env node
// Builds each example for same-origin embedding in the docs site:
// `npm ci` + `vite build --base=/examples/<name>/` into <name>/dist,
// which the docs build then static-copies to /examples/<name>/.
// npm (not pnpm) on purpose — examples are standalone npm projects with
// their own package-lock.json, matching the StackBlitz consumption path.
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = ['helloworld', 'hellosolarsystem', 'hellogalaxy'];

for (const name of EXAMPLES) {
  const cwd = join(root, name);
  console.log(`\n[build-embeds] ${name}: npm ci`);
  execSync('npm ci --no-audit --no-fund', { cwd, stdio: 'inherit' });
  console.log(`[build-embeds] ${name}: vite build --base=/examples/${name}/`);
  execSync(`npm run build -- --base=/examples/${name}/`, {
    cwd,
    stdio: 'inherit',
  });
}
