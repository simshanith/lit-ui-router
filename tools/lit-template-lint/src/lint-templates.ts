#!/usr/bin/env node
// One program-wide lit-analyzer pass (default ruleset) over every tracked
// `src` .ts in packages/, apps/ and examples/. Single invocation on purpose:
// lit-analyzer
// builds one tag registry across the whole run, which is what makes
// cross-package `<ui-view>`/`<ui-router>` usage resolve at all.
// Usage (from anywhere in the workspace): lint-templates
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { defaultExec } from '@tools/shared/exec.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

// Well under the current 74; only catches a glob/`git ls-files` collapse.
const MIN_FILES = 40;

const fail = (message: string): never => {
  console.error(`lint-templates: ${message}`);
  process.exit(1);
};

const { stdout } = await defaultExec(
  'git',
  [
    'ls-files',
    '-z',
    '--',
    'packages/*/src/**/*.ts',
    'apps/*/src/**/*.ts',
    'examples/*/src/**/*.ts',
  ],
  { cwd: root },
);
const files = stdout.split('\0').filter(Boolean);

if (files.length < MIN_FILES) {
  fail(
    `only ${files.length} file(s) matched (expected at least ${MIN_FILES}). ` +
      'The globs have stopped matching the workspace layout; fix them rather ' +
      'than letting the gate quietly analyze nothing.',
  );
}

console.log(
  `lint-templates: analyzing ${files.length} files with lit-analyzer`,
);

const require = createRequire(import.meta.url);
const manifest = require('lit-analyzer/package.json') as {
  bin: Record<string, string>;
};
const cli = require.resolve(`lit-analyzer/${manifest.bin['lit-analyzer']}`);

const child = spawn(process.execPath, [cli, ...files], {
  cwd: root,
  stdio: 'inherit',
});
child.on('error', (error) => fail(String(error)));
child.on('close', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
