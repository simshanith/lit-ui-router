import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { releasesPath, releaseStub, releaseStubs } from '../release-stubs.ts';

describe('releaseStubs', () => {
  it('writes one stub per published package, in name order', () => {
    const stubs = releaseStubs([
      { name: 'ui-router-server' },
      { name: 'postcss-lit-html', private: true },
      { name: 'lit-ui-router', private: false },
      {},
    ]);

    assert.deepEqual(
      stubs.map(({ file }) => file),
      [
        'package-releases/lit-ui-router.md',
        'package-releases/ui-router-server.md',
      ],
    );
  });
});

describe('releaseStub', () => {
  it("titles the page for search and links the worker's page outside the client router", () => {
    const { markdown } = releaseStub('lit-ui-router-ssr');

    assert.ok(markdown.includes('\ntitle: lit-ui-router-ssr releases\n'));
    assert.ok(markdown.includes('\n# lit-ui-router-ssr releases\n'));
    assert.ok(
      markdown.includes(
        '[lit-ui-router-ssr releases page](/releases/lit-ui-router-ssr/){target="_self"}',
      ),
    );
  });
});

describe('releasesPath', () => {
  it('is the slashed package page under the releases mount', () => {
    assert.equal(releasesPath('lit-ui-router'), '/releases/lit-ui-router/');
  });
});
