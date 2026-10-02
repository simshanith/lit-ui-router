#!/usr/bin/env node
// JS pass: oxc transform (type-strip + legacy decorators) then codegen-only minify.
// Comments never ship, so editing them can't trip check:published-diff.
//
// `--development` adds a second emit into dist/development/, for packages whose
// exports map carries the `development` condition. The two passes differ only in
// the `define` of `import.meta.env.DEV`; oxc's define plugin constant-folds the
// guarded branches away, so the production emit carries none of the dev-only
// literals. See check-dev-split.ts for the gate that keeps that true.
//
// Every pass also defines `import.meta.env.PACKAGE_VERSION` as the manifest's
// version, so a package can name its own release without importing package.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { minifySync } from 'oxc-minify';
import { transformSync } from 'oxc-transform';

import { requireManifest } from '@tools/bootstrap/manifest.ts';

import {
  DEV_DEFINE_KEY,
  DEV_OUT,
  VERSION_DEFINE_KEY,
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

// a decorator lowers to an import of this package, so the emitting one must declare it
const RUNTIME = '@oxc-project/runtime';
const { dependencies = {}, version } = requireManifest(process.cwd());
const versionDefine: Record<string, string> =
  version === undefined
    ? {}
    : { [VERSION_DEFINE_KEY]: JSON.stringify(version) };
const undeclaredRuntime = new Set<string>();

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
      define:
        dev === undefined
          ? versionDefine
          : { ...versionDefine, [DEV_DEFINE_KEY]: dev },
    });
    if (transformed.errors.length) fail(file, transformed.errors);
    const printed = minifySync(file, transformed.code, {
      compress: false,
      mangle: false,
      codegen: { removeWhitespace: false },
      sourcemap: true,
    });
    if (printed.errors.length) fail(file, printed.errors);
    if (!(RUNTIME in dependencies) && printed.code.includes(`"${RUNTIME}/`)) {
      undeclaredRuntime.add(file);
    }
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

if (undeclaredRuntime.size > 0) {
  console.error(
    `✗ ${[...undeclaredRuntime].join(', ')} emit imports of ${RUNTIME}, which package.json does not list in dependencies.`,
  );
  process.exit(1);
}
