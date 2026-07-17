#!/usr/bin/env node
// The JS pass of the pass-split build convention: oxc transform strips types
// and lowers legacy decorators, then a codegen-only minify pass
// (compress/mangle off) drops comments — src comments never ship, so editing
// them can't trip check:published-diff. Dependency-free: runs fully parallel
// with every other pass in the repo.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { minifySync } from 'oxc-minify';
import { transformSync } from 'oxc-transform';

import { fail, OUT, publishableSources, SRC } from './shared.ts';

for (const file of publishableSources()) {
  const transformed = transformSync(file, readFileSync(file, 'utf8'), {
    target: 'es2022',
    // tsconfig.base parity: experimentalDecorators + useDefineForClassFields:false
    decorator: { legacy: true },
    assumptions: { setPublicClassFields: true },
    typescript: { removeClassFieldsWithoutInitializer: true },
  });
  if (transformed.errors.length) fail(file, transformed.errors);
  const printed = minifySync(file, transformed.code, {
    compress: false,
    mangle: false,
    codegen: { removeWhitespace: false },
  });
  if (printed.errors.length) fail(file, printed.errors);
  const out = join(OUT, relative(SRC, file)).replace(/\.ts$/, '.js');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, printed.code);
  // Stale tsc-era sourcemap for this module, if the checkout carries one.
  rmSync(`${out}.map`, { force: true });
}
