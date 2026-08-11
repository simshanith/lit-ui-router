#!/usr/bin/env node
// One program-wide lit-analyzer pass (default ruleset) over every tracked
// `src` .ts in packages/, apps/ and examples/. Single invocation on purpose:
// lit-analyzer builds one tag registry across the whole run, which is what
// makes cross-package `<ui-view>`/`<ui-router>` usage resolve at all.
// Usage (from anywhere in the workspace): lint-templates
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultExec } from '@tools/shared/exec.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

// lit-analyzer builds ONE program-wide custom-element registry, so any
// `customElements.define` it sees wins for every analyzed file. This spec
// registers property-less `class Stub extends HTMLElement {}` under the real
// `ui-view` / `ui-router` tag names — that shadowing IS what it tests — and
// the literal tag names are load-bearing, so it cannot be annotated away
// (`@ignore` in every position and an anonymous class were all tried and all
// left the shadowing intact). Positive enumeration is the only exclusion the
// CLI honours: negated globs are silently ignored.
const EXCLUDED = 'packages/lit-ui-router/src/specs/register-guard.spec.ts';

// A lit template in the excluded file would go silently unanalyzed.
const TEMPLATE_TAG = /(?:^|[^.\w$])(?:html|svg|css)\s*`/;

// Well under the current 73; only catches a glob/`git ls-files` collapse.
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
const tracked = stdout.split('\0').filter(Boolean);

if (!tracked.includes(EXCLUDED)) {
  fail(
    `${EXCLUDED} is no longer tracked — it was moved, renamed or deleted, so ` +
      'the exclusion this gate depends on has stopped matching. That spec ' +
      'registers stub elements under the real `ui-view`/`ui-router` tag ' +
      "names, and lit-analyzer's registry is program-wide, so including it " +
      'blinds every other file in the run. Point EXCLUDED at the new path, ' +
      'or delete it here if the spec is gone.',
  );
}

const excludedSource = readFileSync(join(root, EXCLUDED), 'utf8');
if (TEMPLATE_TAG.test(excludedSource)) {
  fail(
    `${EXCLUDED} now contains a lit tagged template, but it is excluded from ` +
      'template analysis: its `customElements.define` stubs shadow the real ' +
      '`ui-view`/`ui-router` definitions across the whole program-wide ' +
      'lit-analyzer run. It must stay template-free — move the template into ' +
      'another spec, or rethink the exclusion (a separate lit-analyzer ' +
      'invocation for the shadowing spec is the obvious escape hatch).',
  );
}

const files = tracked.filter((file) => file !== EXCLUDED);

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
