import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { checkExamples } from './check.ts';
import { formatDiagnostic } from './report.ts';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

describe('checkExamples', () => {
  it('reports each block error at its doc-comment line and column and never a nocheck block', () => {
    const { results, foreign } = checkExamples({
      root: packageDir,
      files: ['fixtures/control.ts'],
      paths: new Map(),
    });

    assert.deepEqual(foreign, []);
    assert.deepEqual(
      results.map((r) => r.status),
      ['semantic', 'semantic', 'skipped', 'clean'],
    );
    assert.deepEqual(
      results.flatMap((r) => r.diagnostics.map(formatDiagnostic)),
      [
        "fixtures/control.ts(5,12): error TS2322: Type 'string' is not assignable to type 'number'.",
        "fixtures/control.ts(10,12): error TS2322: Type 'string' is not assignable to type 'number'.",
      ],
    );
  });

  it('loads the module an augmentation-only block augments', () => {
    const { results, foreign } = checkExamples({
      root: packageDir,
      files: ['fixtures/augment.ts'],
      paths: new Map([
        ['fixture-seam', [path.join(packageDir, 'fixtures/seam.d.ts')]],
      ]),
    });

    assert.deepEqual(foreign, []);
    assert.deepEqual(
      results.map((r) => r.status),
      ['clean', 'semantic'],
    );
    assert.deepEqual(
      results.flatMap((r) => r.diagnostics.map(formatDiagnostic)),
      [
        "fixtures/augment.ts(13,19): error TS2664: Invalid module name in augmentation, module 'fixture-missing' cannot be found.",
      ],
    );
  });
});
