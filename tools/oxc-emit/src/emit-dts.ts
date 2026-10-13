#!/usr/bin/env node
// Types pass: oxc isolated declarations — syntax-derived d.ts, no typechecking.
// Conformance is enforced by the packages' isolatedDeclarations typecheck.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

import { isolatedDeclarationSync } from 'oxc-transform';

import { rewriteInlined } from './inline.ts';
import { emitPlan, fail, OUT, shippedMap } from './shared.ts';

const { units, inlined } = emitPlan();

for (const { file, stem, inlined: embed } of units) {
  const source = readFileSync(file, 'utf8');

  const declaration = isolatedDeclarationSync(file, source, {
    sourcemap: true,
  });

  if (declaration.errors.length) fail(file, declaration.errors);
  const out = join(OUT, `${stem}.d.ts`);
  mkdirSync(dirname(out), { recursive: true });

  // The JS pass's rewriteImportExtensions has no isolated-declarations
  // counterpart; same-length .ts → .js keeps the sourcemap columns valid.
  const code = rewriteInlined(
    declaration.code.replace(
      /((?:from|import\()\s*")(\.[^"]*)\.ts(?=")/g,
      '$1$2.js',
    ),
    stem,
    inlined,
  );

  writeFileSync(out, `${code}//# sourceMappingURL=${basename(out)}.map\n`);
  writeFileSync(
    `${out}.map`,
    shippedMap(
      file,
      out,
      declaration.map!,
      undefined,
      embed ? source : undefined,
    ),
  );
}
