#!/usr/bin/env node
// One program-wide lit-analyzer pass over every `src` .ts in packages/, apps/
// and examples/. Single invocation on purpose: lit-analyzer builds one tag
// registry across the whole run, which is what makes cross-package
// `<ui-view>`/`<ui-router>` usage resolve at all.
//
// examples/ are standalone npm projects that resolve a PUBLISHED lit-ui-router
// from their own lockfile-pinned node_modules (installed by the examples
// postinstall), so they are checked against the released surface rather than
// the workspace one. Verified that this does not shadow the workspace
// definitions: an injected `<ui-view nmae>` in apps/ is still reported.
//
// This wrapper exists only to run lit-analyzer from the repo root with a
// resolved CLI path; the analyzer expands the glob and owns the exit code.
// Usage (from anywhere in the workspace): lint-templates
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { WORKSPACE_SRC_GLOB } from '@tools/shared/globs.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

// Strictness and rule severities live in the root tsconfig's `ts-lit-plugin`
// entry, which lit-analyzer resolves from cwd. Only this flag stays on the
// CLI: it is not a rule, and it makes findings the ruleset leaves at `warn`
// fail too.
const CLI_FLAGS = ['--maxWarnings', '0'];

const require = createRequire(import.meta.url);
const manifest = require('lit-analyzer/package.json') as {
  bin: Record<string, string>;
};
const cli = require.resolve(`lit-analyzer/${manifest.bin['lit-analyzer']}`);

// POSIX-only, so @types/node marks it optional. Replacing this process keeps
// the analyzer's exit code and signals ours without any plumbing.
if (!process.execve) {
  console.error('lint-templates: needs process.execve (POSIX-only, node >=24)');
  process.exit(1);
}

process.chdir(root);
// execve passes argv straight through, so lit-analyzer expands the glob itself.
process.execve(
  process.execPath,
  [process.execPath, cli, ...CLI_FLAGS, WORKSPACE_SRC_GLOB],
  process.env,
);
