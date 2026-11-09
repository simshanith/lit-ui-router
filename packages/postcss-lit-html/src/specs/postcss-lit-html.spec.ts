import type { Document } from 'postcss';
import postcssLit from 'postcss-lit';
import stylelint from 'stylelint';
import { describe, expect, it, vi } from 'vitest';

import syntax, { parse } from '../index.ts';

const RULES = {
  'property-no-unknown': true,
  'function-no-unknown': true,
  'declaration-property-value-no-unknown': true,
};

const FIXABLE = {
  'color-hex-length': 'short',
  'length-zero-no-unit': true,
};

const src = (...lines: string[]) => `${lines.join('\n')}\n`;

async function lint(
  code: string,
  rules: stylelint.Config['rules'] = RULES,
  fix = false,
) {
  const result = await stylelint.lint({
    code,
    codeFilename: 'fixture.ts',
    config: {
      customSyntax: syntax,
      reportNeedlessDisables: true,
      reportDescriptionlessDisables: true,
      rules,
    },
    fix,
  });

  const [{ warnings }] = result.results;

  return {
    code: result.code,
    warnings: warnings
      .map(({ line, column, rule }) => ({ line, column, rule }))
      .sort((a, b) => a.line - b.line || a.column - b.column),
  };
}

/** The 1-based line and column of `needle`'s first occurrence after `from`. */
function at(code: string, needle: string, from = '') {
  const offset = code.indexOf(needle, code.indexOf(from));
  const before = code.slice(0, offset).split('\n');

  return { line: before.length, column: before.at(-1)!.length + 1 };
}

// SAFETY: both parsers always return a Document
const parsed = (code: string, parser = parse) => parser(code) as Document;

/** Each declaration's start in `doc`, in source order. */
function declarations(doc: Document) {
  const out: { prop: string; line: number; column: number; offset: number }[] =
    [];

  doc.walkDecls(({ prop, source }) => {
    const { line = 0, column = 0, offset = 0 } = source?.start ?? {};

    out.push({ prop, line, column, offset });
  });

  return out;
}

/** Runs `check` with console.warn silenced, returning what was warned. */
async function warned(check: () => Promise<void>) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  try {
    await check();

    return warn.mock.calls.map((args) => args.join(' '));
  } finally {
    warn.mockRestore();
  }
}

describe('lint', () => {
  it('passes valid <style> elements, nested ones and expressions in custom properties', async () => {
    const code = src(
      "import { html } from 'lit';",
      'export const a = (color: string) => [',
      '  html`<style>',
      '    p { color: red; }',
      '  </style>`,',
      '  html`<div><template><style>:host { display: block; }</style></template></div>`,',
      '  html`<style>',
      '    p {',
      '      --accent: ${color};',
      '      color: red;',
      '    }',
      '  </style>`,',
      '];',
    );

    expect((await lint(code)).warnings).toEqual([]);
  });

  it('reports a declaration at its line and column in the file', async () => {
    const code = src(
      "import { css, html } from 'lit';",
      'export const a = css`p { color: red; }`;',
      'export const b = html`<p>hi</p>',
      '  <div>',
      '    <style>',
      '      p {',
      '        colr: red;',
      '      }',
      '    </style>',
      '  </div>`;',
    );

    expect((await lint(code)).warnings).toEqual([
      { ...at(code, 'colr'), rule: 'property-no-unknown' },
    ]);
  });

  it('reports an unknown function and the value it makes invalid', async () => {
    const code = src(
      "import { html } from 'lit';",
      'export const a = html`<style>p { color: nonsense(1); }</style>`;',
    );

    expect((await lint(code)).warnings).toEqual(
      expect.arrayContaining([
        { ...at(code, 'nonsense'), rule: 'function-no-unknown' },
        {
          ...at(code, 'nonsense'),
          rule: 'declaration-property-value-no-unknown',
        },
      ]),
    );
    expect((await lint(code)).warnings).toHaveLength(2);
  });

  it('treats expressions as postcss-lit does in a css block', async () => {
    const code = src(
      "import { css, html } from 'lit';",
      'export const a = (c: string) => html`<style>',
      '  p { colr: ${c}; }',
      '  p { color: ${c}; }',
      '</style>`;',
      'export const b = (c: string) => css`',
      '  p { color: ${c}; }',
      '`;',
    );

    const { warnings } = await lint(code);

    expect(warnings).toEqual([
      { ...at(code, 'colr'), rule: 'property-no-unknown' },
      {
        ...at(code, '${c}', 'color'),
        rule: 'declaration-property-value-no-unknown',
      },
      {
        ...at(code, '${c}', 'css`'),
        rule: 'declaration-property-value-no-unknown',
      },
    ]);
  });

  it('honours stylelint disables and reports a needless one', async () => {
    const code = src(
      "import { html } from 'lit';",
      'export const a = html`<style>',
      '  p {',
      '    /* stylelint-disable-next-line property-no-unknown -- fixture */',
      '    colr: red;',
      '  }',
      '  q {',
      '    /* stylelint-disable-next-line property-no-unknown -- fixture */',
      '    color: red;',
      '  }',
      '</style>`;',
    );

    const { warnings } = await lint(code);

    expect(warnings).toEqual([
      {
        line: at(code, '/*', 'q {').line,
        column: expect.any(Number),
        rule: '--report-needless-disables',
      },
    ]);
  });

  it('checks <style> in svg templates and in svg inside html', async () => {
    const code = src(
      "import { html, svg } from 'lit';",
      'export const a = svg`<style>circle { colr: red; }</style><circle r="1" />`;',
      'export const b = html`<svg><style>rect { colr: red; }</style></svg>`;',
    );

    expect((await lint(code)).warnings).toEqual([
      { ...at(code, 'colr'), rule: 'property-no-unknown' },
      { ...at(code, 'colr', 'rect'), rule: 'property-no-unknown' },
    ]);
  });

  it('keeps line numbers when the start tag spans lines', async () => {
    const code = src(
      "import { html } from 'lit';",
      'export const a = html`<style',
      '>p { colr: red; }</style',
      '><style',
      '  media="print"',
      '>',
      '  q { colr: red; }',
      '</style>`;',
    );

    expect((await lint(code)).warnings).toEqual([
      { ...at(code, 'colr'), rule: 'property-no-unknown' },
      { ...at(code, 'colr', 'q {'), rule: 'property-no-unknown' },
    ]);
  });

  it('falls back to postcss-lit when a template nests in another', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const code = src(
      "import { css, html } from 'lit';",
      'export const a = css`a { ${css`b { colr: red; }`} }`;',
      'export const b = html`<style>p { colr: red; }</style>`;',
    );

    try {
      const { warnings } = await lint(code);

      expect(warnings).toEqual([
        { ...at(code, 'colr'), rule: 'property-no-unknown' },
      ]);
      expect(warn).toHaveBeenCalledWith(
        '[postcss-lit-html]',
        expect.stringContaining('overlaps'),
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('skips an html template after a postcss-lit-disable-next-line comment', async () => {
    const code = src(
      "import { html } from 'lit';",
      'export const a = () =>',
      '  // postcss-lit-disable-next-line',
      '  html`<style>p { colr: red; }</style>`;',
    );

    expect((await lint(code)).warnings).toEqual([]);
  });

  it('skips every template under a disabled ancestor', async () => {
    const code = src(
      "import { css, html, svg } from 'lit';",
      '// postcss-lit-disable-next-line',
      'export const styles = [',
      '  css`p { colr: red; }`,',
      '  html`<style>p { colr: red; }</style>`,',
      '  svg`<style>circle { colr: red; }</style>`,',
      '];',
    );

    expect((await lint(code)).warnings).toEqual([]);
  });

  it('does not skip a template after a block disable comment', async () => {
    const code = src(
      "import { html } from 'lit';",
      '/* postcss-lit-disable-next-line */',
      'export const a = html`<style>p { colr: red; }</style>`;',
    );

    expect((await lint(code)).warnings).toEqual([
      { ...at(code, 'colr'), rule: 'property-no-unknown' },
    ]);
  });

  it('reports a template next to a disabled one', async () => {
    const code = src(
      "import { html } from 'lit';",
      'export const a = [',
      '  // postcss-lit-disable-next-line',
      '  html`<style>p { colr: red; }</style>`,',
      '  html`<style>q { colr: red; }</style>`,',
      '];',
    );

    expect((await lint(code)).warnings).toEqual([
      { ...at(code, 'colr', 'q {'), rule: 'property-no-unknown' },
    ]);
  });

  it('leaves files without <style> to postcss-lit', async () => {
    const code = src(
      "import { css, html } from 'lit';",
      'export const a = html`<p>style</p>`;',
      'export const b = css`p { colr: red; }`;',
    );

    expect((await lint(code)).warnings).toEqual([
      { ...at(code, 'colr'), rule: 'property-no-unknown' },
    ]);
  });
});

describe('fallbacks', () => {
  it('lints a <style> and a css block next to a <style> postcss-lit skips', async () => {
    const code = src(
      "import { css, html } from 'lit';",
      'export const a = css`p { colr: red; }`;',
      'export const b = html`<style>a { color: red; </style>`;',
      'export const c = html`<style>q { colr: red; }</style>`;',
    );

    const messages = await warned(async () => {
      expect((await lint(code)).warnings).toEqual([
        { ...at(code, 'colr'), rule: 'property-no-unknown' },
        { ...at(code, 'colr', 'q {'), rule: 'property-no-unknown' },
      ]);
    });

    expect(messages).toEqual([
      expect.stringMatching(
        /^\[postcss-lit\] Skipping template \(\S*fixture\.ts:3\)/,
      ),
    ]);
  });

  it('falls back to postcss-lit when it skips every template', async () => {
    const code = src(
      "import { html } from 'lit';",
      'export const a = html`<style>a { color: red; </style>`;',
    );

    const messages = await warned(async () => {
      expect((await lint(code)).warnings).toEqual([]);
      expect((await lint(code, FIXABLE, true)).code).toBe(code);
    });

    expect(messages).toEqual([
      expect.stringContaining('[postcss-lit] Skipping template'),
      expect.stringContaining('[postcss-lit] Skipping template'),
    ]);
  });

  it('falls back to postcss-lit when the CSS view does not parse', async () => {
    const code = src(
      "import { css, html } from 'lit';",
      'export const a = css`p { colr: red; }`;',
      'export const b = html`<style>${html`<style>a { colr: red; }</style>`}</style>`;',
    );

    const messages = await warned(async () => {
      expect((await lint(code)).warnings).toEqual([
        { ...at(code, 'colr'), rule: 'property-no-unknown' },
      ]);
    });

    expect(messages).toEqual([
      expect.stringMatching(
        /^\[postcss-lit-html\] Skipping <style> elements \(\S*fixture\.ts\): the CSS view did not parse/,
      ),
    ]);
  });
});

// each body's source text, as String.raw keeps it
const ESCAPES: [string, string[]][] = [
  [
    'a \\\\ escape',
    [String.raw`.a::before { content: "\\2014"; --p1: 1; }`, '.b { --p2: 1; }'],
  ],
  [
    'a lone escape',
    [String.raw`.a::before { content: "\u2014"; --p1: 1; }`, '.b { --p2: 1; }'],
  ],
  [
    'several escapes on one line',
    [
      String.raw`.a\\:b::before { content: "\\2014\\\\\u2014"; --p1: 1; --p2: 2; }`,
      '.b { --p3: 1; }',
    ],
  ],
  [
    'escapes before a multi-line rule',
    [
      String.raw`.a::before { content: "\\2014\\2014"; }`,
      '.b {',
      '  --p1: 1;',
      '  --p2: 2;',
      '}',
    ],
  ],
  [
    'an escaped backtick and ${',
    [
      String.raw`.a::before { content: "\`\${x}"; --p1: 1; }`,
      '.b { --p2: 1; }',
    ],
  ],
];

const asCss = (body: string) => `export const a = css\`${body}\`;\n`;

const asStyle = (body: string) =>
  `export const a = html\`<style>${body}</style>\`;\n`;

describe('escapes', () => {
  describe.each([
    ['in a css block', asCss],
    ['in a <style> element', asStyle],
  ])('%s', (_, wrap) => {
    it.each(ESCAPES)('places declarations after %s', (_name, lines) => {
      for (const body of [`\n${lines.join('\n')}\n`, lines.join('\n')]) {
        const code = wrap(body);

        for (const { prop, line, column, offset } of declarations(
          parsed(code),
        )) {
          expect({ prop, line, column }).toEqual({ prop, ...at(code, prop) });
          expect(code.startsWith(prop, offset)).toBe(true);
        }
      }
    });

    it('matches a stylelint-disable-next-line comment to its target', async () => {
      const code = wrap(
        src(
          '',
          `.a::before { content: "${String.raw`\\2014`.repeat(10)}"; }`,
          '.b {',
          '  /* stylelint-disable-next-line property-no-unknown --',
          '  fixture */',
          '  colr: red;',
          '}',
        ),
      );

      expect((await lint(code)).warnings).toEqual([]);
    });
  });

  it.each(ESCAPES)(
    "matches postcss-lit's lines in a css block with %s, and its columns where it counts them right",
    (_name, lines) => {
      for (const body of [`\n${lines.join('\n')}\n`, lines.join('\n')]) {
        const code = asCss(body);
        const ours = declarations(parsed(code));
        const theirs = declarations(parsed(code, postcssLit.parse));

        expect(ours.map(({ line }) => line)).toEqual(
          theirs.map(({ line }) => line),
        );

        ours.forEach(({ line, column }, i) => {
          const before = code.split('\n')[line - 1].slice(0, column - 1);

          // postcss-lit counts a template's first line from the template, and drops a backslash per `\\`
          if (!/[`\\]/.test(before)) expect(column).toBe(theirs[i].column);
        });
      }
    },
  );
});

describe('--fix', () => {
  it('fixes css blocks and <style> contents in place', async () => {
    const code = src(
      "import { css, html } from 'lit';",
      'export const a = css`',
      '  p { color: #ffffff; margin: 0px; }',
      '`;',
      'export const b = (c: string) => html`<p>${c}</p><style>',
      '  p { color: #aabbcc; --x: ${c}; padding: 0px; }',
      '</style><div><style>.q { color: #000000; }</style><style>.r { margin: 0px; }</style></div>`;',
      'export const d = css`.z { margin: 0px; }`;',
    );

    const fixed = await lint(code, FIXABLE, true);

    expect(fixed.code).toBe(
      src(
        "import { css, html } from 'lit';",
        'export const a = css`',
        '  p { color: #fff; margin: 0; }',
        '`;',
        'export const b = (c: string) => html`<p>${c}</p><style>',
        '  p { color: #abc; --x: ${c}; padding: 0; }',
        '</style><div><style>.q { color: #000; }</style><style>.r { margin: 0; }</style></div>`;',
        'export const d = css`.z { margin: 0; }`;',
      ),
    );

    expect((await lint(fixed.code!, FIXABLE)).warnings).toEqual([]);
  });

  it('leaves a disabled html template byte for byte', async () => {
    const code = src(
      "import { html } from 'lit';",
      'export const a = [',
      '  // postcss-lit-disable-next-line',
      '  html`<style>p { color: #ffffff; margin: 0px; }</style>`,',
      '  html`<style>q { color: #ffffff; }</style>`,',
      '];',
    );

    expect((await lint(code, FIXABLE, true)).code).toBe(
      code.replace('q { color: #ffffff; }', 'q { color: #fff; }'),
    );
  });

  it('leaves the file byte-identical when nothing is fixable', async () => {
    const code = src(
      "import { css, html } from 'lit';",
      '// postcss-lit-disable-next-line',
      'export const a = css`${"p"} { color: red; }`;',
      'export const b = (c: string) => html`',
      '  <style',
      '    media="screen"',
      '  >',
      '    p {',
      '      color: ${c};',
      '      margin: ${',
      '        c',
      '      };',
      '    }',
      '  </style>',
      '`;',
      'export const d = css`',
      '  p { color: red; }',
      '`;',
    );

    expect((await lint(code, FIXABLE, true)).code).toBe(code);
  });
  it.each([
    ['a lone escape', String.raw`.a::before { content: "\u2014"; }`],
    ['a \\\\ escape', String.raw`.a::before { content: "\\2014"; }`],
    [
      'mixed escapes',
      String.raw`.a\\:b::before { content: "\\2014\u2014\\\\\u2014\`\${x}"; }`,
    ],
  ])('writes a <style> with %s back byte for byte', async (_, rule) => {
    const code = src(
      "import { html } from 'lit';",
      `export const a = (c: string) => html\`<style>`,
      `  ${rule}`,
      '  .b { color: ${c}; }',
      '</style>`;',
    );

    expect((await lint(code, FIXABLE, true)).code).toBe(code);

    const fixable = code.replace('.b {', '.b { margin: 0px;');

    expect((await lint(fixable, FIXABLE, true)).code).toBe(
      fixable.replace('0px', '0'),
    );
  });
});
