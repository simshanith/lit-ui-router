import { describe, it, expect } from 'vitest';
import { domMatchers, domSnapshotSerializer, getDiffableHTML } from '../dom.ts';

expect.extend(domMatchers);

expect.addSnapshotSerializer(domSnapshotSerializer);

function fragment(html: string): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;

  return template.content;
}

describe('getDiffableHTML', () => {
  it('prints one element or text run per indented line', () => {
    expect(getDiffableHTML('<div><p>a</p>b<span>c</span></div>')).toBe(
      [
        '<div>',
        '  <p>',
        '    a',
        '  </p>',
        '  b',
        '  <span>',
        '    c',
        '  </span>',
        '</div>',
      ].join('\n'),
    );
  });

  it('drops comments and joins the text around them', () => {
    // the shape lit renders for `Hello ${name}`
    expect(getDiffableHTML('<p>Hello <!--?lit$123$-->World<!----></p>')).toBe(
      '<p>\n  Hello World\n</p>',
    );
  });

  it('collapses whitespace runs and drops blank text', () => {
    expect(getDiffableHTML('\n  <p>\n   a \n\t b  </p>\n')).toBe(
      '<p>\n  a b\n</p>',
    );
  });

  it('sorts attributes and class tokens', () => {
    expect(getDiffableHTML('<a z="1" class="c  a b" href="/x"></a>')).toBe(
      '<a class="a b c" href="/x" z="1">\n</a>',
    );
  });

  it('escapes & and " in attribute values', () => {
    expect(getDiffableHTML(`<a title='a "b" &amp; c'></a>`)).toBe(
      '<a title="a &quot;b&quot; &amp; c">\n</a>',
    );
  });

  it('strips blank class and id but keeps blank boolean attributes', () => {
    expect(getDiffableHTML('<input class=" " id="" disabled>')).toBe(
      '<input disabled="">',
    );
  });

  it('honours stripEmptyAttributes', () => {
    expect(
      getDiffableHTML('<p title="" class=""></p>', {
        stripEmptyAttributes: ['title'],
      }),
    ).toBe('<p class="">\n</p>');
  });

  it('omits closing tags of void elements', () => {
    expect(getDiffableHTML('<p>a<br>b<img src="x"></p>')).toBe(
      '<p>\n  a\n  <br>\n  b\n  <img src="x">\n</p>',
    );
  });

  it('drops script, style and svg with their subtrees', () => {
    expect(
      getDiffableHTML(
        '<div><script>x()</script><style>p{}</style><svg><path></path></svg>a</div>',
      ),
    ).toBe('<div>\n  a\n</div>');
  });

  it('drops ignoreTags on top of the defaults', () => {
    expect(
      getDiffableHTML('<div><em>x</em><script></script>a</div>', {
        ignoreTags: ['em'],
      }),
    ).toBe('<div>\n  a\n</div>');
  });

  it('prints ignoreChildren tags without their children', () => {
    expect(
      getDiffableHTML('<div><my-el a="1"><p>x</p></my-el></div>', {
        ignoreChildren: ['my-el'],
      }),
    ).toBe('<div>\n  <my-el a="1">\n  </my-el>\n</div>');
  });

  it('ignores string attributes on every tag', () => {
    expect(
      getDiffableHTML('<div id="a" data-x="1"><p data-x="2"></p></div>', {
        ignoreAttributes: ['data-x'],
      }),
    ).toBe('<div id="a">\n  <p>\n  </p>\n</div>');
  });

  it('ignores {tags, attributes} entries on the named tags only', () => {
    expect(
      getDiffableHTML('<div data-x="1"><p data-x="2"></p></div>', {
        ignoreAttributes: [{ tags: ['p'], attributes: ['data-x'] }],
      }),
    ).toBe('<div data-x="1">\n  <p>\n  </p>\n</div>');
  });

  it('prints an Element itself, a fragment its children', () => {
    const el = document.createElement('section');
    el.innerHTML = '<p>a</p>';
    expect(getDiffableHTML(el)).toBe(
      '<section>\n  <p>\n    a\n  </p>\n</section>',
    );
    expect(getDiffableHTML(fragment('<p>a</p>b'))).toBe('<p>\n  a\n</p>\nb');
  });

  it('prints a text node collapsed', () => {
    expect(getDiffableHTML(document.createTextNode('  a \n b '))).toBe('a b');
  });

  it('rejects other node types', () => {
    expect(() => getDiffableHTML(document.createComment('x'))).toThrow(
      'Cannot create diffable HTML from: #comment',
    );
  });

  it('parses strings without connecting custom elements', () => {
    let connected = 0;
    customElements.define(
      'dom-spec-counted',
      class extends HTMLElement {
        connectedCallback() {
          connected++;
        }
      },
    );
    getDiffableHTML('<dom-spec-counted></dom-spec-counted>');
    expect(connected).toBe(0);
  });

  describe('shadowRoots', () => {
    function host() {
      const el = document.createElement('div');
      el.attachShadow({ mode: 'open' }).innerHTML = '<p>shadow</p>';
      el.innerHTML = '<span>light</span>';

      return el;
    }

    it('skips shadow roots by default', () => {
      expect(getDiffableHTML(host())).toBe(
        '<div>\n  <span>\n    light\n  </span>\n</div>',
      );
    });

    it('prints an open shadow root ahead of the light DOM', () => {
      expect(getDiffableHTML(host(), { shadowRoots: true })).toBe(
        [
          '<div>',
          '  #shadow-root',
          '    <p>',
          '      shadow',
          '    </p>',
          '  <span>',
          '    light',
          '  </span>',
          '</div>',
        ].join('\n'),
      );
    });

    it('prints a ShadowRoot passed directly as its children', () => {
      expect(getDiffableHTML(host().shadowRoot!)).toBe('<p>\n  shadow\n</p>');
    });
  });
});

describe('toEqualDom', () => {
  it('passes on semantically equal markup', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p class="b a"  id="x">  hi <!--?lit$1$--></p>';
    expect(el).toEqualDom('<div><p id="x" class="a b">hi</p></div>');
    expect(el.firstElementChild).toEqualDom('<p class="a b" id="x">hi</p>');
  });

  it('accepts a Node as the expectation', () => {
    expect('<p>a</p>').toEqualDom(fragment('<p> a </p>'));
  });

  it('fails with both sides normalised for the diff', () => {
    let error: unknown;

    try {
      expect('<p class="b a">x</p>').toEqualDom('<p class="a">x</p>');
    } catch (e) {
      error = e;
    }

    expect(error).toMatchObject({
      message: 'expected DOM to equal (semantic diff)',
      actual: '<p class="a b">\n  x\n</p>',
      expected: '<p class="a">\n  x\n</p>',
    });
  });

  it('negates', () => {
    expect('<p>a</p>').not.toEqualDom('<p>b</p>');
    expect(() => expect('<p>a</p>').not.toEqualDom('<p>a</p>')).toThrow(
      'expected DOM not to equal:\n<p>\n  a\n</p>',
    );
  });

  it('forwards options to both sides', () => {
    expect('<p data-x="1">a</p>').toEqualDom('<p data-x="2">a</p>', {
      ignoreAttributes: ['data-x'],
    });
  });

  it('works as an asymmetric matcher', () => {
    expect({ view: '<p class="b a"></p>' }).toEqual({
      view: expect.toEqualDom('<p class="a b"></p>'),
    });
  });

  it('rejects values that are neither Node nor string', () => {
    expect(() => expect(42).toEqualDom('<p></p>')).toThrow(
      'toEqualDom expects a Node or an HTML string, received 42',
    );
  });
});

describe('domSnapshotSerializer', () => {
  it('prints Elements diffable', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p class="b a">x<!---->y</p>';
    expect(el).toMatchInlineSnapshot(`
      <div>
        <p class="a b">
          xy
        </p>
      </div>
    `);
  });

  it('leaves other values alone', () => {
    expect(domSnapshotSerializer.test('<p></p>')).toBe(false);
  });
});
