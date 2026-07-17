#!/usr/bin/env node
// The types pass of the pass-split build convention: oxc isolated
// declarations — syntax-derived d.ts with JSDoc intact, no typechecking and
// no cross-package inputs, so the pass is dependency-free like the JS pass.
// Conformance (explicit annotations on the public surface) is enforced by
// the packages' typecheck task via `isolatedDeclarations: true`, keeping
// this emit trustworthy.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { isolatedDeclarationSync } from 'oxc-transform';

import { fail, OUT, publishableSources, SRC } from './shared.ts';

for (const file of publishableSources()) {
  const declaration = isolatedDeclarationSync(file, readFileSync(file, 'utf8'));
  if (declaration.errors.length) fail(file, declaration.errors);
  const out = join(OUT, relative(SRC, file)).replace(/\.ts$/, '.d.ts');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, declaration.code);
  // Stale tsc-era declaration map, if the checkout carries one.
  rmSync(`${out}.map`, { force: true });
}
