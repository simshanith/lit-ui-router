// Hands the CSS of each `<style>` element in an `html` template to stylelint,
// with the repo's stylelint.config.mjs. Each file becomes a same-length copy
// that keeps only its `<style>` contents, wrapped as `css` blocks, so
// postcss-lit treats expressions as it does in a component's `css` block and
// stylelint's positions are the file's own.
import {
  type DefaultTreeAdapterTypes as T,
  defaultTreeAdapter,
  html as parse5Html,
  parseFragment,
} from 'parse5';

import { Markup, TEMPLATE_CONTEXT, type TemplateSite } from './lower.ts';

export interface StyleElement {
  /** Source offset of the tag name, as the lowering places the element's checks. */
  tagAt: number;
  start: number;
  cssStart: number;
  cssEnd: number;
}

export interface StyleFinding {
  at: number;
  text: string;
}

const OPEN = 'css`';

const CLOSE = '`';

function stylesIn(
  nodes: T.ChildNode[],
  markup: Markup,
  out: StyleElement[],
): void {
  for (const node of nodes) {
    if (!defaultTreeAdapter.isElementNode(node)) continue;

    const location = node.sourceCodeLocation;
    const texts = node.childNodes.filter(defaultTreeAdapter.isTextNode);

    if (
      node.tagName === 'style' &&
      location &&
      texts.length === node.childNodes.length
    ) {
      const cssStart = location.startTag?.endOffset ?? location.endOffset;
      const cssEnd = location.endTag?.startOffset ?? location.endOffset;

      out.push({
        tagAt: markup.toSource(location.startOffset + 1),
        start: markup.toSource(location.startOffset),
        cssStart: markup.toSource(cssStart),
        cssEnd: markup.toSource(cssEnd),
      });
      continue;
    }

    const template =
      node.tagName === 'template' && node.namespaceURI === parse5Html.NS.HTML;

    stylesIn(
      // SAFETY: parse5 builds every HTML <template> with its content fragment
      template ? (node as T.Template).content.childNodes : node.childNodes,
      markup,
      out,
    );
  }
}

/** The `<style>` elements of a file's `html` templates. */
export function styleElements(
  source: string,
  sites: TemplateSite[],
): StyleElement[] {
  const out: StyleElement[] = [];

  for (const site of sites) {
    if (site.tag !== 'html') continue;

    if (
      !site.strings.some((span) =>
        /<style\b/i.test(source.slice(span.start, span.end)),
      )
    ) {
      continue;
    }

    const markup = new Markup(source, site);

    const fragment = parseFragment(TEMPLATE_CONTEXT, markup.text, {
      sourceCodeLocationInfo: true,
    });

    stylesIn(fragment.childNodes, markup, out);
  }

  return out.sort((a, b) => a.start - b.start);
}

const blank = (text: string) => text.replace(/[^\n]/g, ' ');

/** The source with everything but the style contents blanked, line breaks kept. */
export function cssView(source: string, styles: StyleElement[]): string {
  let view = '';
  let cursor = 0;

  for (const { start, cssStart, cssEnd } of styles) {
    // a `;` keeps two blocks on one line from parsing as one expression
    const separator = source[start - 1] === '\n' ? '\n' : ';';

    view +=
      blank(source.slice(cursor, start - 1)) +
      separator +
      OPEN +
      blank(source.slice(start + OPEN.length, cssStart)) +
      source.slice(cssStart, cssEnd) +
      CLOSE;
    cursor = cssEnd + CLOSE.length;
  }

  return view + blank(source.slice(cursor));
}

const lineStarts = (text: string): number[] => {
  const starts = [0];

  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) {
    starts.push(i + 1);
  }

  return starts;
};

/** stylelint's findings in each file's `<style>` elements, keyed by element `tagAt`. */
export async function lintStyles(
  files: { path: string; source: string; styles: StyleElement[] }[],
): Promise<Map<string, Map<number, StyleFinding[]>>> {
  const byFile = new Map<string, Map<number, StyleFinding[]>>();

  if (files.length === 0) return byFile;
  const { default: stylelint } = await import('stylelint');

  for (const { path, source, styles } of files) {
    const { results } = await stylelint.lint({
      code: cssView(source, styles),
      codeFilename: path,
    });

    const starts = lineStarts(source);
    const byElement = new Map<number, StyleFinding[]>();

    for (const warning of results.flatMap((result) => result.warnings)) {
      const at = (starts[warning.line - 1] ?? 0) + warning.column - 1;

      const style =
        styles.filter((element) => element.start <= at).at(-1) ?? styles[0];

      const findings = byElement.get(style.tagAt) ?? [];
      findings.push({ at, text: warning.text });
      byElement.set(style.tagAt, findings);
    }

    byFile.set(path, byElement);
  }

  return byFile;
}
