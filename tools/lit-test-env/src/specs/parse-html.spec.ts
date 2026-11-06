import { getByRole, queryByRole } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';

import { parseHtml } from '../parse-html.ts';

describe('parseHtml', () => {
  it('answers role and name queries without the global document', () => {
    const doc = parseHtml(
      '<nav><a href="/about">About <code>us</code></a></nav>',
    );

    expect(doc).not.toBe(document);
    expect(
      getByRole(doc.body, 'link', { name: 'About us' }).getAttribute('href'),
    ).toBe('/about');
    expect(queryByRole(doc.body, 'heading')).toBeNull();
  });
});
