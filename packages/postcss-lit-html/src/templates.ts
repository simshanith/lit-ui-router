import { parse as babelParse, type ParserOptions } from '@babel/parser';
import { type Node, traverse } from '@babel/types';
import {
  type DefaultTreeAdapterTypes as T,
  defaultTreeAdapter,
  html as parse5Html,
  parseFragment,
} from 'parse5';
import { isDisableComment } from 'postcss-lit/lib/util.js';

export interface Span {
  start: number;
  end: number;
}

/** A lit `html` or `svg` tagged template; `strings` has one more entry than its expressions. */
export interface TemplateSite {
  tag: 'html' | 'svg';
  strings: Span[];
}

/** The `html`/`svg` templates postcss-lit doesn't skip, and the bodies and strings of the `css` templates. */
export interface FileTemplates {
  sites: TemplateSite[];
  cssBodies: Span[];
  cssStrings: Span[];
}

/** A `<style>` element whose children are all text. */
export interface StyleElement {
  /** Source offset of the `<` that opens the start tag. */
  start: number;
  cssStart: number;
  cssEnd: number;
  /** The `${…}` spans in the contents. */
  expressions: Span[];
}

const hasDisableComment = (node: Node) =>
  node.leadingComments?.some(isDisableComment) === true;

const spanOf = ({ start, end }: Node): Span => ({
  start: start ?? 0,
  end: end ?? 0,
});

/** Every lit tagged template in `source`, found with postcss-lit's Babel options. */
export function templatesOf(
  source: string,
  babelOptions: ParserOptions,
): FileTemplates {
  const sites: TemplateSite[] = [];
  const cssBodies: Span[] = [];
  const cssStrings: Span[] = [];

  traverse(babelParse(source, babelOptions).program, (node, ancestors) => {
    if (node.type !== 'TaggedTemplateExpression') return;
    const { tag, quasi } = node;
    const name = tag.type === 'Identifier' ? tag.name : undefined;

    if (name === 'css') {
      cssBodies.push({
        start: (quasi.start ?? 0) + 1,
        end: (quasi.end ?? 0) - 1,
      });
      cssStrings.push(...quasi.quasis.map(spanOf));
    } else if (
      (name === 'html' || name === 'svg') &&
      // postcss-lit honours the comment on the template or any ancestor
      !hasDisableComment(node) &&
      !ancestors.some((ancestor) => hasDisableComment(ancestor.node))
    ) {
      sites.push({
        tag: name,
        strings: quasi.quasis.map(spanOf),
      });
    }
  });

  return { sites, cssBodies, cssStrings };
}

const marker = (i: number) => `$lit${i}$`;

// lit parses `html` templates in a <template> element and `svg` ones in an <svg>
const CONTEXT = {
  html: defaultTreeAdapter.createElement('template', parse5Html.NS.HTML, []),
  svg: defaultTreeAdapter.createElement('svg', parse5Html.NS.SVG, []),
};

interface Chunk {
  markupStart: number;
  sourceStart: number;
  length: number;
}

/** One template's markup, expressions replaced by markers, with the way back to source. */
class Markup {
  readonly text: string;
  readonly #chunks: Chunk[] = [];

  constructor(source: string, site: TemplateSite) {
    let text = '';

    site.strings.forEach((span, i) => {
      this.#chunks.push({
        markupStart: text.length,
        sourceStart: span.start,
        length: span.end - span.start,
      });
      text += source.slice(span.start, span.end);

      if (i < site.strings.length - 1) text += marker(i);
    });

    this.text = text;
  }

  toSource(offset: number): number {
    let best = this.#chunks[0];

    for (const chunk of this.#chunks) {
      if (chunk.markupStart <= offset) best = chunk;
    }

    return best.sourceStart + Math.min(offset - best.markupStart, best.length);
  }
}

type Found = Omit<StyleElement, 'expressions'>;

function stylesIn(nodes: T.ChildNode[], markup: Markup, out: Found[]): void {
  for (const node of nodes) {
    if (!defaultTreeAdapter.isElementNode(node)) continue;

    const location = node.sourceCodeLocation;

    if (
      node.tagName === 'style' &&
      location &&
      node.childNodes.every(defaultTreeAdapter.isTextNode)
    ) {
      out.push({
        start: markup.toSource(location.startOffset),
        cssStart: markup.toSource(
          location.startTag?.endOffset ?? location.endOffset,
        ),
        cssEnd: markup.toSource(
          location.endTag?.startOffset ?? location.endOffset,
        ),
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

/** The `<style>` elements of a file's `html` and `svg` templates, in source order. */
export function styleElements(
  source: string,
  sites: TemplateSite[],
): StyleElement[] {
  const out: StyleElement[] = [];

  for (const site of sites) {
    if (
      !site.strings.some((span) =>
        /<style\b/i.test(source.slice(span.start, span.end)),
      )
    ) {
      continue;
    }

    const markup = new Markup(source, site);
    const found: Found[] = [];

    stylesIn(
      parseFragment(CONTEXT[site.tag], markup.text, {
        sourceCodeLocationInfo: true,
      }).childNodes,
      markup,
      found,
    );

    const holes = site.strings.slice(1).map((next, i) => ({
      start: site.strings[i].end,
      end: next.start,
    }));

    for (const style of found) {
      out.push({
        ...style,
        expressions: holes.filter(
          (hole) => hole.start >= style.cssStart && hole.end <= style.cssEnd,
        ),
      });
    }
  }

  return out.sort((a, b) => a.start - b.start);
}

/** The contents of `style` between its expressions. */
export function stringsOf({
  cssStart,
  cssEnd,
  expressions,
}: StyleElement): Span[] {
  const out: Span[] = [];
  let start = cssStart;

  for (const hole of expressions) {
    out.push({ start, end: hole.start });
    start = hole.end;
  }

  out.push({ start, end: cssEnd });

  return out;
}
