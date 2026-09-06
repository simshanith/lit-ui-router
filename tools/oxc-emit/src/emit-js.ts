#!/usr/bin/env node
// JS pass: oxc transform (type-strip + legacy decorators) then codegen-only minify.
// Comments never ship, so editing them can't trip check:published-diff.
//
// `--development` adds a second emit into dist/development/, for packages whose
// exports map carries the `development` condition. The two passes differ only in
// the `define` of `import.meta.env.DEV`; oxc's define plugin constant-folds the
// guarded branches away, so the production emit carries none of the dev-only
// literals. See check-dev-split.ts for the gate that keeps that true.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { minifySync } from 'oxc-minify';
import { transformSync } from 'oxc-transform';

import {
  DEV_DEFINE_KEY,
  DEV_OUT,
  fail,
  OUT,
  publishableSources,
  shippedMap,
  SRC,
} from './shared.ts';

const dual = process.argv.includes('--development');

// production first, so a `--development` package's dist/*.js is byte-identical
// to what the single-pass build emitted for it before the split
const passes = dual
  ? [
      { out: OUT, dev: 'false' },
      { out: DEV_OUT, dev: 'true' },
    ]
  : [{ out: OUT, dev: undefined }];

for (const file of publishableSources()) {
  const source = readFileSync(file, 'utf8');
  for (const { out: outDir, dev } of passes) {
    const transformed = transformSync(file, source, {
      target: 'es2022',
      sourcemap: true,
      // tsconfig.base parity: experimentalDecorators + useDefineForClassFields:false
      decorator: { legacy: true },
      assumptions: { setPublicClassFields: true },
      typescript: {
        removeClassFieldsWithoutInitializer: true,
        // ui-router-server sources import with .ts specifiers so node --test
        // can type-strip them directly; no-op for extensionless imports
        rewriteImportExtensions: 'rewrite',
      },
      ...(dev === undefined ? {} : { define: { [DEV_DEFINE_KEY]: dev } }),
    });
    if (transformed.errors.length) fail(file, transformed.errors);
    const printed = minifySync(file, transformed.code, {
      compress: false,
      mangle: false,
      codegen: { removeWhitespace: false },
      sourcemap: true,
    });
    if (printed.errors.length) fail(file, printed.errors);
    const out = join(outDir, relative(SRC, file)).replace(/\.ts$/, '.js');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      `${printed.code}//# sourceMappingURL=${basename(out)}.map\n`,
    );
    writeFileSync(
      `${out}.map`,
      shippedMap(file, out, printed.map!, transformed.map),
    );
  }
}
