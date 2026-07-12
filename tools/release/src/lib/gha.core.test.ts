import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  endGroupCommand,
  errorCommand,
  groupCommand,
  outputLine,
} from './gha.core.ts';

describe('workflow commands', () => {
  it('emits plain group/endgroup/error commands', () => {
    assert.equal(
      groupCommand('Publish lit-ui-router'),
      '::group::Publish lit-ui-router',
    );
    assert.equal(endGroupCommand(), '::endgroup::');
    assert.equal(errorCommand('boom'), '::error::boom');
  });

  it('escapes %, CR, and LF so multi-line data stays one command line', () => {
    assert.equal(
      errorCommand('50% done\r\nnext'),
      '::error::50%25 done%0D%0Anext',
    );
    assert.equal(groupCommand('a\nb'), '::group::a%0Ab');
  });
});

describe('outputLine', () => {
  it('formats name=value', () => {
    assert.equal(
      outputLine('package_name', 'lit-ui-router'),
      'package_name=lit-ui-router',
    );
    assert.equal(
      outputLine('tarball', '/tmp/x/pkg-1.0.0.tgz'),
      'tarball=/tmp/x/pkg-1.0.0.tgz',
    );
  });

  it('rejects names the pipeline never hand-writes', () => {
    assert.throws(() => outputLine('bad name', 'x'), /invalid output name/);
    assert.throws(() => outputLine('', 'x'), /invalid output name/);
    assert.throws(() => outputLine('a=b', 'x'), /invalid output name/);
  });

  it('rejects multi-line values instead of corrupting GITHUB_OUTPUT', () => {
    assert.throws(() => outputLine('tag', 'a\nb'), /single-line/);
    assert.throws(() => outputLine('tag', 'a\rb'), /single-line/);
  });
});
