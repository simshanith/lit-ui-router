import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  findDevSplitViolations,
  findProcessReads,
  formatDevSplitReport,
  messagePrefix,
  nodeImportRoots,
} from './check-dev-split.core.ts';

const prefix = messagePrefix('lit-ui-router');

const devOnly = ['lit-ui-router: uiSref wrote href='];

const kept = "console.warn('lit-ui-router: <ui-view> is already defined');";

// as it survives emit: the template literal breaks at the interpolated quote
const emitted =
  'console.warn(`lit-ui-router: uiSref wrote href="' + '${href}" to <x>`);';

describe('findDevSplitViolations', () => {
  it('passes when the declared message ships in development only', () => {
    assert.deepEqual(
      findDevSplitViolations({
        prefix,
        devOnly,
        production: kept,
        development: `${emitted}${kept}`,
      }),
      [],
    );
  });

  it('fails when a dev-only message leaks into production', () => {
    const violations = findDevSplitViolations({
      prefix,
      devOnly,
      production: emitted,
      development: emitted,
    });

    assert.equal(violations.length, 1);
    assert.match(violations[0], /leaked into dist/);
  });

  it('fails when a dev-only message is missing from development', () => {
    const violations = findDevSplitViolations({
      prefix,
      devOnly,
      production: '',
      development: '',
    });

    assert.equal(violations.length, 1);
    assert.match(violations[0], /missing from dist\/development/);
  });

  it('fails when development carries an undeclared dev-only message', () => {
    const violations = findDevSplitViolations({
      prefix,
      devOnly: [],
      production: '',
      development: emitted,
    });

    assert.equal(violations.length, 1);
    assert.match(violations[0], /undeclared dev-only message/);
  });

  it("ignores another package's prefix", () => {
    // lit-ui-router-mobx: must not be scanned as lit-ui-router:
    assert.deepEqual(
      findDevSplitViolations({
        prefix,
        devOnly: [],
        production: '',
        development: "console.warn('lit-ui-router-mobx: no router');",
      }),
      [],
    );
  });

  it('ignores messages both builds carry', () => {
    assert.deepEqual(
      findDevSplitViolations({
        prefix,
        devOnly: [],
        production: kept,
        development: kept,
      }),
      [],
    );
  });
});

describe('nodeImportRoots', () => {
  it('places each node target in every emit tree', () => {
    assert.deepEqual(
      nodeImportRoots(
        {
          '#dev-gate': {
            node: './dist/dev-gate.node.js',
            default: './dist/dev-gate.js',
          },
          '#outside': { node: './src/gate.ts' },
          '#browser': { default: './dist/plain.js' },
        },
        ['dist', 'dist/development'],
      ),
      ['dist/dev-gate.node.js', 'dist/development/dev-gate.node.js'],
    );
  });

  it('has none without an imports map', () => {
    assert.deepEqual(nodeImportRoots(undefined, ['dist']), []);
  });
});

describe('findProcessReads', () => {
  const gate =
    'export const devGate = () => process.env.NODE_ENV !== "production";';

  const files = (extra: Record<string, string> = {}) =>
    new Map(
      Object.entries({
        'dist/dev-gate.node.js':
          'export { devGate } from "./shared/dev-gate.js";',
        'dist/shared/dev-gate.js': gate,
        'dist/index.js': 'import { devGate } from "#dev-gate";',
        ...extra,
      }),
    );

  it('passes a read the node target reaches', () => {
    assert.deepEqual(findProcessReads(files(), ['dist/dev-gate.node.js']), []);
  });

  it('fails a read no node target reaches', () => {
    assert.deepEqual(
      findProcessReads(
        files({ 'dist/development/warn.js': 'if (process.env.X) {}' }),
        ['dist/dev-gate.node.js', 'dist/development/dev-gate.node.js'],
      ),
      [
        'dist/development/warn.js mentions process, which only a package.json#imports node target may read',
      ],
    );
  });

  it('fails every read when the package maps no node target', () => {
    assert.deepEqual(findProcessReads(files(), []), [
      'dist/shared/dev-gate.js mentions process, which only a package.json#imports node target may read',
    ]);
  });
});

describe('formatDevSplitReport', () => {
  it('reports the declared count when clean', () => {
    const report = formatDevSplitReport([], 2);
    assert.equal(report.ok, true);
    assert.match(report.text, /2 dev-only messages/);
  });

  it('lists every violation when dirty', () => {
    const report = formatDevSplitReport(['a', 'b'], 2);
    assert.equal(report.ok, false);
    assert.match(report.text, /• a\n {2}• b/);
  });
});
