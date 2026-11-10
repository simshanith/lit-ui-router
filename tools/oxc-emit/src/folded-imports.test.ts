import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { dropFoldedImports } from './folded-imports.ts';

describe('dropFoldedImports', () => {
  const unfolded =
    '// ✓ note\nimport "./register.js";\nimport { devGate } from "#dev-gate";\nexport const a = 1;\n';

  it('blanks a bare import the fold left behind, keeping offsets', () => {
    const folded =
      '// ✓ note\nimport "./register.js";\nimport "#dev-gate";\nexport const a = 1;\n';

    const code = dropFoldedImports('a.js', folded, unfolded);

    assert.equal(code.length, folded.length);
    assert.equal(
      code,
      '// ✓ note\nimport "./register.js";\n                   \nexport const a = 1;\n',
    );
  });

  it('leaves code without a folded import untouched', () => {
    assert.equal(dropFoldedImports('a.js', unfolded, unfolded), unfolded);
  });
});
