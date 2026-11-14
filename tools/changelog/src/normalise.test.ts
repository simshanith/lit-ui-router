import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { leadingHeadingStyle, normaliseBody } from './normalise.ts';

describe('normaliseBody', () => {
  it('leaves a body of ### sections as published', () => {
    const body = '### Features\n\n* a\n\n### Bug Fixes\n\n* b';

    assert.deepEqual(normaliseBody(body), { body, applied: [] });
  });

  it('demotes ## headings to ###, keeping their nesting', () => {
    assert.deepEqual(
      normaliseBody(
        "## What's Changed\n* a\n### Detail\n\n## New Contributors\n* b",
      ),
      {
        body: "### What's Changed\n* a\n#### Detail\n\n### New Contributors\n* b",
        applied: ['demote-headings'],
      },
    );
  });

  it('leaves a heading inside a code fence alone', () => {
    const body = '### Features\n\n```md\n# literal\n```';

    assert.deepEqual(normaliseBody(body), { body, applied: [] });
  });

  for (const heading of [
    '## [1.2.0](https://example.com/compare/a...b) (2026-01-01)',
    '# v1.2.0',
    '## lit-ui-router@1.2.0',
  ]) {
    it(`strips a leading version heading: ${heading}`, () => {
      assert.deepEqual(normaliseBody(`${heading}\n\n### Features\n\n* a`), {
        body: '### Features\n\n* a',
        applied: ['strip-leading-version-heading', 'trim-blank-lines'],
      });
    });
  }

  it('keeps a leading heading that names no version', () => {
    assert.deepEqual(normaliseBody('### 2026 roadmap\n\n* a').applied, []);
  });

  it('trims blank lines around the body, not the words', () => {
    assert.deepEqual(normaliseBody('\n* a  \n\n'), {
      body: '* a  ',
      applied: ['trim-blank-lines'],
    });
  });

  it('converts CRLF line endings', () => {
    assert.deepEqual(normaliseBody('* a\r\n* b'), {
      body: '* a\n* b',
      applied: ['normalise-line-endings'],
    });
  });
});

describe('leadingHeadingStyle', () => {
  it('names the marker and whether the heading is a version', () => {
    assert.equal(leadingHeadingStyle('### Features\n'), '### <section>');
    assert.equal(leadingHeadingStyle("\n## What's Changed"), '## <section>');
    assert.equal(
      leadingHeadingStyle('## [1.0.0](x) (2026-01-01)'),
      '## <version>',
    );
  });

  it('is none for a body that opens with text', () => {
    assert.equal(leadingHeadingStyle('* fix: a'), 'none');
    assert.equal(leadingHeadingStyle(''), 'none');
  });
});
