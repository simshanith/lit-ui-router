import stylelint from 'stylelint';
import { describe, expect, it, vi } from 'vitest';

import syntax from '../index.ts';

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
      '      color: var(--accent);',
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
});
