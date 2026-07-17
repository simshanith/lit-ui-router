// The JS half of the two-pass build (tsc emits declarations only): oxc
// transform strips types and lowers the legacy lit decorators, then a
// codegen-only minify pass (compress/mangle off) drops comments — src
// comments never ship, so editing them can't trip check:published-diff.
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

import { minifySync } from 'oxc-minify';
import { transformSync } from 'oxc-transform';

const SRC = 'src';
const OUT = 'dist';

const fail = (file: string, errors: { message: string }[]): never => {
  throw new Error(
    `${file}: ${errors.map((error) => error.message).join('\n')}`,
  );
};

const sources = readdirSync(SRC, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => join(entry.parentPath, entry.name))
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));

for (const file of sources) {
  const transformed = transformSync(file, readFileSync(file, 'utf8'), {
    target: 'es2022',
    // tsconfig parity: experimentalDecorators + useDefineForClassFields:false
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
