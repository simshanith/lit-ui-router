#!/usr/bin/env node
// One program-wide lit-analyzer pass (strict ruleset) over every tracked
// `src` .ts in the pnpm workspace's packages/ and apps/. Single invocation on
// purpose: lit-analyzer builds one tag registry across the whole run, which is
// what makes cross-package `<ui-view>`/`<ui-router>` usage resolve at all.
//
// examples/ is deliberately out of scope: those are standalone npm projects
// with their own package.json, node_modules and registry deps (including a
// published lit-ui-router), wired up by a postinstall shim rather than being
// workspace members, so their type environment is not this repo's.
// Usage (from anywhere in the workspace): lint-templates
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { defaultExec } from '@tools/shared/exec.ts';

const root = fileURLToPath(new URL('../../..', import.meta.url));

// Strictness and rule severities live in the root tsconfig's `ts-lit-plugin`
// entry, which lit-analyzer resolves from cwd. Only this flag stays on the
// CLI: it is not a rule, and it makes findings the ruleset leaves at `warn`
// fail too.
const CLI_FLAGS = ['--maxWarnings', '0'];

const IN_SCOPE = /^(?:packages|apps)\/[^/]+\/src\//;

// A count floor cannot catch enumeration drift: the pathspec bug this
// replaced dropped 36 of 110 files (every file sitting directly in `src/`,
// because a bare `**/` requires an intervening directory) and no plausible
// floor would have noticed. These are template-bearing files that must be in
// the set; if one goes missing the enumeration has silently narrowed.
const ANCHORS = [
  'packages/lit-ui-router/src/ui-view.ts',
  'packages/lit-ui-router/src/core.ts',
  'apps/sample-app-shared/src/main.ts',
];

// Well under the current 108; only catches a total `git ls-files` collapse.
const MIN_FILES = 80;

const fail = (message: string): never => {
  console.error(`lint-templates: ${message}`);
  process.exit(1);
};

const { stdout } = await defaultExec('git', ['ls-files', '-z', '--', '*.ts'], {
  cwd: root,
});
const files = stdout
  .split('\0')
  .filter(Boolean)
  .filter((file) => IN_SCOPE.test(file));

const missing = ANCHORS.filter((anchor) => !files.includes(anchor));
if (missing.length > 0) {
  fail(
    `these template-bearing files are not in the analyzed set: ${missing.join(
      ', ',
    )}. Either they moved (update ANCHORS) or the enumeration has narrowed ` +
      'and is silently skipping files — fix it rather than dropping the anchor.',
  );
}

if (files.length < MIN_FILES) {
  fail(
    `only ${files.length} file(s) matched (expected at least ${MIN_FILES}). ` +
      'The enumeration has stopped matching the workspace layout; fix it ' +
      'rather than letting the gate quietly analyze nothing.',
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

const child = spawn(process.execPath, [cli, ...CLI_FLAGS, ...files], {
  cwd: root,
  stdio: 'inherit',
});
child.on('error', (error) => fail(String(error)));
child.on('close', (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
