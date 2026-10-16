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
// `--node` (with `--development`) adds a third emit into dist/node/, for the
// `node` condition: DEV is true as in dist/development, and
// `import.meta.env.NODE` is true there and false in the other two, so a
// warning gated on `import.meta.env.NODE && process.env.NODE_ENV` keeps that
// runtime check in dist/node alone.
//
// A source that reads `import.meta.env.PACKAGE_VERSION` gets the manifest's version
// defined, so a package can name its own release without importing package.json.
// A pass with nothing to define passes no `define`, keeping its emit unchanged.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { minifySync } from 'oxc-minify';
import { transformSync } from 'oxc-transform';

import { requireManifest } from '@tools/bootstrap/manifest.ts';

import { rewriteInlined } from './inline.ts';
import {
  DEV_OUT,
  emitPlan,
  NODE_OUT,
  fail,
  OUT,
  passDefine,
  shippedMap,
} from './shared.ts';

const main = (): void => {
  const dual = process.argv.includes('--development');
  const node = dual && process.argv.includes('--node');

  // production first, so a `--development` package's dist/*.js is byte-identical
  // to what the single-pass build emitted for it before the split
  const passes: { out: string; dev?: string; node?: string }[] = dual
    ? [
        { out: OUT, dev: 'false', node: node ? 'false' : undefined },
        { out: DEV_OUT, dev: 'true', node: node ? 'false' : undefined },
        ...(node ? [{ out: NODE_OUT, dev: 'true', node: 'true' }] : []),
      ]
    : [{ out: OUT }];

  // a decorator lowers to an import of this package, so the emitting one must declare it
  const RUNTIME = '@oxc-project/runtime';

  const { dependencies = {}, version } = requireManifest(process.cwd());

  const undeclaredRuntime = new Set<string>();

  const { units, inlined } = emitPlan();

  for (const { file, stem, inlined: embed } of units) {
    const source = readFileSync(file, 'utf8');

    for (const { out: outDir, dev, node: nodePass } of passes) {
      const define = passDefine(source, version, dev, nodePass);

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
        define,
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

      const out = join(outDir, `${stem}.js`);
      const code = rewriteInlined(printed.code, stem, inlined);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, `${code}//# sourceMappingURL=${basename(out)}.map\n`);
      writeFileSync(
        `${out}.map`,
        shippedMap(
          file,
          out,
          printed.map!,
          transformed.map,
          embed ? source : undefined,
        ),
      );
    }
  }

  if (undeclaredRuntime.size > 0) {
    console.error(
      `✗ ${[...undeclaredRuntime].join(', ')} emit imports of ${RUNTIME}, which package.json does not list in dependencies.`,
    );
    process.exitCode = 1;
  }
};

if (import.meta.main) main();
