#!/usr/bin/env node
// Builds each example for same-origin embedding in the docs site:
// `vite build --base=/examples/<name>/` into <name>/dist, which the docs
// build then static-copies to /examples/<name>/.
// Each example's node_modules comes from this package's postinstall hook —
// npm (not pnpm) on purpose, matching the StackBlitz consumption path.
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const EXAMPLES = ['helloworld', 'hellosolarsystem', 'hellogalaxy'];

for (const name of EXAMPLES) {
  const cwd = join(root, name);
  console.log(`[build-embeds] ${name}: vite build --base=/examples/${name}/`);
  execSync(`npm run build -- --base=/examples/${name}/`, {
    cwd,
    stdio: 'inherit',
  });
}
