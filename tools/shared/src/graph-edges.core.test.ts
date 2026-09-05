import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatMissing, missingEdges } from './graph-edges.core.ts';

describe('missingEdges', () => {
  const resolved = [
    '^build',
    'lit-ui-router#build',
    'lit-ui-router-mobx#build',
  ];

  it('passes when every member has its producer edge', () => {
    assert.deepEqual(
      missingEdges(['lit-ui-router', 'lit-ui-router-mobx'], 'build', resolved),
      [],
    );
  });

  it('reports missing members sorted', () => {
    assert.deepEqual(
      missingEdges(
        ['ui-router-navigation-location-plugin', 'lit-ui-router', 'a-new-pkg'],
        'build',
        resolved,
      ),
      ['a-new-pkg', 'ui-router-navigation-location-plugin'],
    );
  });

  it('does not count an edge onto a different task', () => {
    assert.deepEqual(
      missingEdges(['lit-ui-router'], 'docs:api', ['lit-ui-router#build']),
      ['lit-ui-router'],
    );
  });
});

describe('formatMissing', () => {
  it('names the consumer, the dependsOn lines and the rationale', () => {
    const text = formatMissing(
      {
        consumer: 'lit-ui-router.dev#build',
        producerTask: 'docs:api',
        why: 'because',
      },
      ['a-new-pkg'],
    );
    assert.match(
      text,
      /^lit-ui-router\.dev#build does not order on "a-new-pkg#docs:api": because$/,
    );
  });
});
