import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TemplateSite } from './lower.ts';
import { cssView, styleElements } from './styles.ts';

const source =
  'x = html`<p></p><style id="a">\n  p { color: ${c}; }\n</style>`;';

// one `html` site with one expression, as ./sites.ts reports it
const site = (): TemplateSite => {
  const open = source.indexOf('`') + 1;
  const expr = source.indexOf('${');
  const close = source.lastIndexOf('`');

  return {
    tag: 'html',
    start: open - 5,
    end: close + 1,
    strings: [
      { start: open, end: expr },
      { start: expr + 4, end: close },
    ],
    expressions: [{ start: expr + 2, end: expr + 3 }],
  };
};

describe('the css view of a file', () => {
  const styles = styleElements(source, [site()]);

  it('finds the style element and its contents in source offsets', () => {
    assert.equal(styles.length, 1);
    const [{ tagAt, cssStart, cssEnd }] = styles;

    assert.equal(source.slice(tagAt, tagAt + 5), 'style');
    assert.equal(source.slice(cssStart, cssEnd), '\n  p { color: ${c}; }\n');
  });

  it('keeps every offset and line, and only the contents as a css block', () => {
    const view = cssView(source, styles);

    assert.equal(view.length, source.length);
    assert.equal(view.split('\n').length, source.split('\n').length);
    assert.equal(
      view.replace(/ +/g, ' ').trim(),
      ';css` \n p { color: ${c}; }\n`',
    );
  });
});
