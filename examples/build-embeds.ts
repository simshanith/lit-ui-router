#!/usr/bin/env node
// Builds each example for same-origin embedding in the docs site:
// `npm run build -- --base=/examples/<name>/` into <name>/dist, which the docs
// build then static-copies to /examples/<name>/.
// Each example's node_modules comes from this package's postinstall hook —
// npm (not pnpm) on purpose, matching the StackBlitz consumption path.
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EXAMPLE_NAMES } from './embeds.ts';

const root = dirname(fileURLToPath(import.meta.url));

for (const name of EXAMPLE_NAMES) {
  const cwd = join(root, name);
  const command = `npm run build -- --base=/examples/${name}/`;
  console.log(`[build-embeds] ${name}: ${command}`);
  execSync(command, {
    cwd,
    stdio: 'inherit',
  });
}
