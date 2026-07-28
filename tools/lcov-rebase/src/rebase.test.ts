import assert from 'node:assert/strict';
import { test } from 'node:test';

import { rebaseLcov } from './rebase.ts';

const record = (sf: string) => `TN:\nSF:${sf}\nDA:1,1\nend_of_record\n`;

test('prefixes package-relative SF paths', () => {
  assert.equal(
    rebaseLcov(record('src/index.ts'), 'packages/ui-router-server'),
    record('packages/ui-router-server/src/index.ts'),
  );
});

test('resolves cross-package .. escapes onto the real package', () => {
  assert.equal(
    rebaseLcov(
      record('../../tools/bundle-probe/src/bundle.ts'),
      'packages/ui-router-server',
    ),
    record('tools/bundle-probe/src/bundle.ts'),
  );
});

test('leaves absolute SF paths untouched', () => {
  const absolute = record('/repo/packages/x/src/index.ts');
  assert.equal(rebaseLcov(absolute, 'packages/x'), absolute);
});

test('touches only SF records', () => {
  const report = 'TN:\nSF:src/a.ts\nDA:1,1\nLF:1\nLH:1\nend_of_record\n';
  const rebased = rebaseLcov(report, 'packages/x');
  assert.match(rebased, /^DA:1,1$/m);
  assert.match(rebased, /^LF:1$/m);
  assert.equal(rebased.match(/packages\/x/g)?.length, 1);
});
