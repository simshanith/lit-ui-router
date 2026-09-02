// The oxlint `jsPlugins` lane (#676): the same rule, loaded by bare specifier
// into oxlint at the exact catalog pin. `jsPlugins` is alpha and outside
// semver, so this gates the pinned version only — a bump PR is where a break
// surfaces, the same way the eslint-plugin-oxlint exact pin works.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const oxlintBin = join(
  dirname(require_.resolve('oxlint/package.json')),
  'bin',
  'oxlint',
);

interface Diagnostic {
  message: string;
  code: string;
  severity: string;
  filename: string;
}

const run = (): Diagnostic[] => {
  let stdout: string;
  try {
    stdout = execFileSync(
      process.execPath,
      [oxlintBin, '--config', '.oxlintrc.json', '-f', 'json', 'anchors.js'],
      { cwd: here, encoding: 'utf8' },
    );
  } catch (error) {
    // oxlint exits non-zero when it reports; the JSON still rides stdout.
    stdout = (error as { stdout?: string }).stdout ?? '';
  }
  const parsed = JSON.parse(stdout) as { diagnostics: Diagnostic[] };
  return parsed.diagnostics;
};

void describe('oxlint jsPlugins', () => {
  const diagnostics = run();

  void it('reports exactly the two dead anchors, under our rule id', () => {
    assert.deepEqual(
      diagnostics.map((diagnostic) => diagnostic.code),
      ['lit-ui-router(anchor-is-valid)', 'lit-ui-router(anchor-is-valid)'],
    );
  });

  void it('reports both as noHref, not preferButton or invalidHref', () => {
    for (const diagnostic of diagnostics) {
      assert.match(diagnostic.message, /^The href attribute is required/);
      assert.equal(diagnostic.severity, 'error');
    }
  });

  void it('leaves the uiSref anchor alone', () => {
    // Line 5 is the navigable anchor; only lines 6 and 7 may report.
    const lines = diagnostics.map(
      (diagnostic) =>
        (diagnostic as unknown as { labels: { span: { line: number } }[] })
          .labels[0]?.span.line,
    );
    assert.deepEqual(lines, [6, 7]);
  });
});
