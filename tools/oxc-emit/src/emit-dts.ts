#!/usr/bin/env node
// Types pass: oxc isolated declarations — syntax-derived d.ts, no typechecking.
// Conformance is enforced by the packages' isolatedDeclarations typecheck.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

import { isolatedDeclarationSync } from 'oxc-transform';

import { fail, OUT, publishableSources, shippedMap, SRC } from './shared.ts';

for (const file of publishableSources()) {
  const declaration = isolatedDeclarationSync(
    file,
    readFileSync(file, 'utf8'),
    { sourcemap: true },
  );
  if (declaration.errors.length) fail(file, declaration.errors);
  const out = join(OUT, relative(SRC, file)).replace(/\.ts$/, '.d.ts');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${declaration.code}//# sourceMappingURL=${basename(out)}.map\n`,
  );
  writeFileSync(`${out}.map`, shippedMap(file, out, declaration.map!));
}
