import type { StyleElement } from './templates.ts';

const LINE_BREAK = /[\n\r\u2028\u2029]/;

// line breaks stay, so Babel and postcss count the same lines as in the source
const blank = (text: string) => text.replace(/[^\n\r\u2028\u2029]/g, ' ');

/** Writes `text` into the non-line-break slots of `[from, to)`, last character at the last slot. */
function stampEnd(view: string[], from: number, to: number, text: string) {
  let i = to;

  for (let j = text.length - 1; j >= 0; j--) {
    do i--;
    while (i >= from && LINE_BREAK.test(view[i]));

    if (i < from) throw new Error(`no room for ${text} in [${from}, ${to})`);
    view[i] = text[j];
  }
}

/**
 * The source with everything blanked but each `<style>` element's contents,
 * wrapped as a `css` template in the element's own start tag and end tag
 * characters. It is the source's length, with its line breaks, so postcss-lit
 * places every node at the file's own line, column and offset.
 */
export function cssView(source: string, styles: StyleElement[]): string {
  const view = blank(source).split('');

  for (const { start, cssStart, cssEnd, expressions } of styles) {
    for (let i = cssStart; i < cssEnd; i++) view[i] = source[i];

    // an expression's text is restored from the source when stringifying
    for (const hole of expressions) {
      for (let i = hole.start; i < hole.end; i++) {
        view[i] = LINE_BREAK.test(source[i]) ? source[i] : ' ';
      }

      view[hole.start] = '$';
      view[hole.start + 1] = '{';
      stampEnd(view, hole.start + 2, hole.end - 1, '0');
      view[hole.end - 1] = '}';
    }

    // the `;` keeps two elements on one line from parsing as one expression
    stampEnd(view, start, cssStart, ';css`');
    view[cssEnd] = '`';
  }

  return view.join('');
}
