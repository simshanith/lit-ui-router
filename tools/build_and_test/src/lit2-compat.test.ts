import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyCompatRange,
  assertPeerRangeCoversMajor2,
  compatRange,
} from './lit2-compat.core.ts';

const WORKSPACE_YAML = `catalog:
  happy-dom: ^20.11.1
  lit: ^3.3.3
  lit-dialog: ^2.0.1

catalogs:
  lit2-compat:
    lit: ^2.8.0
  publishedPeer:
    hono: ^4.0.0
    lit: '^2.0.0 || ^3.0.0'
    lit-ui-router: ^1.7.0
`;

describe('compatRange', () => {
  it('reads the lit2-compat catalog pin', () => {
    assert.equal(compatRange(WORKSPACE_YAML), '^2.8.0');
  });

  it('rejects a workspace without the catalog', () => {
    assert.throws(
      () => compatRange('catalog:\n  lit: ^3.3.3\n'),
      /no lit2-compat catalog/,
    );
  });

  it('rejects a pin outside major 2', () => {
    assert.throws(
      () => compatRange('  lit2-compat:\n    lit: ^3.0.0\n'),
      /not a lit 2\.x range/,
    );
  });
});

describe('assertPeerRangeCoversMajor2', () => {
  it('accepts a peer range with a 2.x disjunct', () => {
    assert.equal(
      assertPeerRangeCoversMajor2(WORKSPACE_YAML),
      '^2.0.0 || ^3.0.0',
    );
  });

  it('rejects a peer range narrowed back to major 3', () => {
    assert.throws(
      () => assertPeerRangeCoversMajor2('  publishedPeer:\n    lit: ^3.0.0\n'),
      /no longer covers major 2/,
    );
  });

  it('rejects a workspace without the peer range', () => {
    assert.throws(
      () => assertPeerRangeCoversMajor2('catalog:\n  lit: ^3.3.3\n'),
      /no publishedPeer lit range/,
    );
  });
});

describe('applyCompatRange', () => {
  it('repoints only the default-catalog lit entry', () => {
    const rewritten = applyCompatRange(WORKSPACE_YAML, '^2.8.0');
    assert.match(rewritten, /^ {2}lit: \^2\.8\.0$/m);
    // named-catalog entries and lit-prefixed neighbors stay put
    assert.match(rewritten, /^ {4}lit: '\^2\.0\.0 \|\| \^3\.0\.0'$/m);
    assert.match(rewritten, /^ {2}lit-dialog: \^2\.0\.1$/m);
    assert.match(rewritten, /^ {4}lit: \^2\.8\.0$/m);
  });

  it('rejects a workspace without a default-catalog lit entry', () => {
    assert.throws(
      () =>
        applyCompatRange(
          'catalogs:\n  lit2-compat:\n    lit: ^2.8.0\n',
          '^2.8.0',
        ),
      /no default-catalog lit entry/,
    );
  });
});
