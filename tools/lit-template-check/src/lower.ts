// Lowers Lit `html` templates to a type-check block: each template becomes a
// comma expression of typed helper calls in place, so expressions keep their
// scope and control-flow narrowing, followed by an empty `html``` of the same
// type. Expression text is copied verbatim and mapped back span for span.
import {
  type DefaultTreeAdapterTypes as T,
  defaultTreeAdapter,
  html as parse5Html,
  parseFragment,
} from 'parse5';

import {
  type LocalEvents,
  type LocalTag,
  PRELUDE_NAMESPACE as NS,
  prelude,
} from './prelude.ts';

export interface Span {
  start: number;
  end: number;
}

/** A tagged template in the source; `strings` has one more entry than `expressions`. */
export interface TemplateSite extends Span {
  tag: string;
  strings: Span[];
  expressions: Span[];
}

export type Rule =
  | 'unknown-tag'
  | 'unknown-attribute'
  | 'attribute-binding'
  | 'boolean-binding'
  | 'property-binding'
  | 'event-binding'
  | 'element-binding'
  | 'child-binding'
  | 'directive';

/**
 * `verbatim` maps position for position; `atom` maps every position to one
 * original offset; `outside` is untouched or wrapper code whose diagnostics
 * belong to the ordinary typecheck; `prelude` is ours and must stay clean.
 */
export interface Segment {
  virtualStart: number;
  virtualEnd: number;
  originalStart: number;
  kind: 'verbatim' | 'atom' | 'outside' | 'prelude';
  rule?: Rule;
}

export interface LowerStats {
  templates: number;
  lowered: Record<string, number>;
  skipped: Record<string, number>;
  directives: Record<string, number>;
}

export interface Lowered {
  text: string;
  segments: Segment[];
  stats: LowerStats;
}

const MARKER = /\$ltc(\d+)\$/g;

const marker = (i: number) => `$ltc${i}$`;

const DIRECTIVE_COMMENT = /^\s*@ts-(expect-error|ignore)\b/;

const bump = (record: Record<string, number>, key: string) => {
  record[key] = (record[key] ?? 0) + 1;
};

// lit's own template element context: table parts and the like parse in place
const TEMPLATE_CONTEXT = defaultTreeAdapter.createElement(
  'template',
  parse5Html.NS.HTML,
  [],
);

class Builder {
  text = '';
  segments: Segment[] = [];

  push(
    text: string,
    kind: Segment['kind'],
    originalStart = -1,
    rule?: Rule,
  ): void {
    if (text.length === 0) return;

    const segment: Segment = {
      virtualStart: this.text.length,
      virtualEnd: this.text.length + text.length,
      originalStart,
      kind,
    };

    if (rule) segment.rule = rule;
    this.text += text;
    this.segments.push(segment);
  }
}

interface Chunk {
  htmlStart: number;
  sourceStart: number;
  length: number;
}

/** One template's markup, with the way back from markup offsets to source. */
class Markup {
  readonly text: string;
  readonly #chunks: Chunk[] = [];

  constructor(source: string, site: TemplateSite) {
    let text = '';

    site.strings.forEach((span, i) => {
      this.#chunks.push({
        htmlStart: text.length,
        sourceStart: span.start,
        length: span.end - span.start,
      });
      text += source.slice(span.start, span.end);

      if (i < site.expressions.length) text += marker(i);
    });

    this.text = text;
  }

  toSource(offset: number): number {
    let best = this.#chunks[0];

    for (const chunk of this.#chunks) {
      if (chunk.htmlStart <= offset) best = chunk;
    }

    return best.sourceStart + Math.min(offset - best.htmlStart, best.length);
  }
}

const BINDINGS = {
  '.': { fn: 'prop', rule: 'property-binding', kind: 'property' },
  '?': { fn: 'bool', rule: 'boolean-binding', kind: 'boolean' },
  '@': { fn: 'on', rule: 'event-binding', kind: 'event' },
} as const;

const isBindingPrefix = (prefix: string): prefix is keyof typeof BINDINGS =>
  Object.hasOwn(BINDINGS, prefix);

const markerIndexes = (text: string) =>
  [...text.matchAll(MARKER)].map(([, index]) => Number(index));

interface Attribute {
  name: string;
  value: string;
  nameAt: number;
}

class FileLowerer {
  readonly out = new Builder();
  readonly stats: LowerStats = {
    templates: 0,
    lowered: {},
    skipped: {},
    directives: {},
  };

  readonly source: string;
  readonly sites: TemplateSite[];
  #site!: TemplateSite;
  #markup!: Markup;
  #placed = new Set<number>();
  #pendingDirective: { text: string; at: number } | undefined;

  constructor(source: string, sites: TemplateSite[]) {
    this.source = source;
    this.sites = sites;
  }

  /** Copies [start, end) verbatim, lowering every outermost site inside it. */
  range(start: number, end: number, kind: 'verbatim' | 'outside', rule?: Rule) {
    let cursor = start;

    for (const site of this.sites) {
      if (site.start < cursor || site.end > end) continue;
      this.out.push(this.source.slice(cursor, site.start), kind, cursor, rule);
      this.template(site);
      cursor = site.end;
    }

    this.out.push(this.source.slice(cursor, end), kind, cursor, rule);
  }

  template(site: TemplateSite): void {
    this.stats.templates += 1;

    if (site.tag !== 'html') {
      bump(this.stats.skipped, `template:${site.tag}`);
      this.out.push(
        this.source.slice(site.start, site.end),
        'outside',
        site.start,
      );

      return;
    }

    // nested templates lower inside expressions, so the per-template state stacks
    const saved = [this.#site, this.#markup, this.#placed] as const;
    this.#site = site;
    this.#markup = new Markup(this.source, site);
    this.#placed = new Set();

    const fragment = parseFragment(TEMPLATE_CONTEXT, this.#markup.text, {
      sourceCodeLocationInfo: true,
    });

    this.out.push('(', 'outside', site.start);
    this.nodes(fragment.childNodes, false);

    site.expressions.forEach((_, i) => {
      if (this.#placed.has(i)) return;
      bump(this.stats.skipped, 'unplaced-binding');
      this.call('child', () => this.expression(i, 'child-binding'));
    });

    this.out.push(`\n${site.tag}\`\`)`, 'outside', site.start);
    [this.#site, this.#markup, this.#placed] = saved;
  }

  expression(i: number, rule: Rule): void {
    this.#placed.add(i);
    const span = this.#site.expressions[i];
    this.out.push('(', 'atom', span.start, rule);
    this.range(span.start, span.end, 'verbatim', rule);
    this.out.push(')', 'atom', span.start, rule);
    this.directive(span);
  }

  children(text: string, stat: Record<string, number>, key: string): void {
    for (const index of markerIndexes(text)) {
      bump(stat, key);
      this.call('child', () => this.expression(index, 'child-binding'));
    }
  }

  nodes(nodes: T.ChildNode[], svg: boolean): void {
    for (const node of nodes) {
      if (defaultTreeAdapter.isCommentNode(node)) {
        this.comment(node);
      } else if (defaultTreeAdapter.isTextNode(node)) {
        this.children(node.value, this.stats.lowered, 'child');
      } else if (defaultTreeAdapter.isElementNode(node)) {
        const inSvg = svg || node.namespaceURI === parse5Html.NS.SVG;
        this.element(node, inSvg);

        const template =
          node.tagName === 'template' &&
          node.namespaceURI === parse5Html.NS.HTML;

        this.nodes(
          // SAFETY: parse5 builds every HTML <template> with its content fragment
          template ? (node as T.Template).content.childNodes : node.childNodes,
          inSvg,
        );
      }
    }
  }

  comment(node: T.CommentNode): void {
    const match = DIRECTIVE_COMMENT.exec(node.data);

    if (match) {
      this.#pendingDirective = {
        text: `// @ts-${match[1]}`,
        at: this.#markup.toSource(node.sourceCodeLocation?.startOffset ?? 0),
      };
    }

    this.children(node.data, this.stats.skipped, 'comment-binding');
  }

  /** Counts the directive a binding expression calls, if it is a bare call. */
  directive(span: Span): void {
    const name = /^([A-Za-z_$][\w$]*)\(/.exec(
      this.source.slice(span.start, span.end),
    )?.[1];

    if (name) bump(this.stats.directives, name);
  }

  call(fn: string, args: () => void): void {
    this.out.push(`${NS}.${fn}(`, 'outside');
    args();
    this.out.push('), ', 'outside');
  }

  literal(text: string, at: number, rule: Rule): void {
    this.out.push(JSON.stringify(text), 'atom', at, rule);
  }

  /** One line per element, so a directive comment covers all of its checks. */
  element(node: T.Element, svg: boolean): void {
    this.out.push('\n', 'outside', this.#site.start);

    if (this.#pendingDirective) {
      const { text, at } = this.#pendingDirective;
      this.out.push(text, 'atom', at);
      this.out.push('\n', 'outside', this.#site.start);
      this.#pendingDirective = undefined;
    }

    const location = node.sourceCodeLocation;
    const tag = node.tagName;
    const tagAt = this.#markup.toSource((location?.startOffset ?? 0) + 1);

    const ref = () =>
      this.out.push(
        `${NS}.${svg ? 'svgEl' : 'el'}<${JSON.stringify(tag)}>()`,
        'atom',
        tagAt,
      );

    this.tag(node, svg, tagAt);

    for (const { name, value } of node.attrs) {
      const attrLocation =
        location?.attrs?.[name] ?? location?.attrs?.[name.toLowerCase()];

      if (!attrLocation) {
        bump(this.stats.skipped, 'attribute-without-location');
        continue;
      }

      // the parser lowercased the name; lit binds the source spelling
      const raw = this.#markup.text.slice(
        attrLocation.startOffset,
        attrLocation.endOffset,
      );

      this.attribute(
        {
          name: /^[^\s=]+/.exec(raw)?.[0] ?? name,
          value,
          nameAt: this.#markup.toSource(attrLocation.startOffset),
        },
        svg,
        ref,
      );
    }
  }

  tag(node: T.Element, svg: boolean, tagAt: number): void {
    if (/\$ltc\d+\$/.test(node.tagName)) {
      bump(this.stats.skipped, 'dynamic-tag');
    } else if (node.namespaceURI === parse5Html.NS.MATHML) {
      bump(this.stats.skipped, 'mathml-tag');
    } else {
      bump(this.stats.lowered, 'tag');
      this.call(svg ? 'svgTag' : 'tag', () =>
        this.literal(node.tagName, tagAt, 'unknown-tag'),
      );
    }
  }

  attribute(attribute: Attribute, svg: boolean, ref: () => void): void {
    const { name, value, nameAt } = attribute;
    const nameIndexes = markerIndexes(name);

    if (nameIndexes.length > 0) {
      bump(this.stats.lowered, 'element');

      for (const index of nameIndexes) {
        this.call('element', () => this.expression(index, 'element-binding'));
      }

      return;
    }

    const prefix = name[0];

    if (isBindingPrefix(prefix)) {
      this.binding(attribute, prefix, ref);

      return;
    }

    if (svg) {
      bump(this.stats.skipped, 'svg-attribute-name');
    } else {
      bump(this.stats.lowered, 'attribute-name');
      this.call('attr', () => {
        ref();
        this.out.push(', ', 'outside');
        this.literal(name.toLowerCase(), nameAt, 'unknown-attribute');
      });
    }

    for (const index of markerIndexes(value)) {
      bump(this.stats.lowered, 'attribute');
      this.call('value', () => this.expression(index, 'attribute-binding'));
    }
  }

  binding(
    { name, value, nameAt }: Attribute,
    prefix: keyof typeof BINDINGS,
    ref: () => void,
  ): void {
    const indexes = markerIndexes(value);

    if (indexes.length !== 1 || value.trim() !== marker(indexes[0])) {
      bump(this.stats.skipped, `${prefix}binding-interpolated`);
      this.children(value, this.stats.skipped, 'interpolated-part');

      return;
    }

    const { fn, rule, kind } = BINDINGS[prefix];
    const bare = name.slice(1);

    bump(this.stats.lowered, kind);
    this.call(fn, () => {
      ref();
      this.out.push(', ', 'outside');
      this.literal(
        prefix === '?' ? bare.toLowerCase() : bare,
        nameAt + 1,
        rule,
      );
      this.out.push(', ', 'outside');
      this.expression(indexes[0], rule);
    });
  }
}

export function lowerFile(
  source: string,
  sites: TemplateSite[],
  litModule: string,
  {
    locals = [],
    events = [],
  }: { locals?: LocalTag[]; events?: LocalEvents[] } = {},
): Lowered {
  const sorted = [...sites].sort((a, b) => a.start - b.start);
  const lowerer = new FileLowerer(source, sorted);
  lowerer.range(0, source.length, 'outside');
  lowerer.out.push(
    prelude(litModule, locals, events),
    'prelude',
    source.length,
  );

  return {
    text: lowerer.out.text,
    segments: lowerer.out.segments,
    stats: lowerer.stats,
  };
}

export interface Mapped {
  offset: number;
  segment: Segment;
}

/** The original offset of a virtual position, or undefined outside the checks. */
export function toOriginal(
  segments: Segment[],
  position: number,
): Mapped | undefined {
  let low = 0;
  let high = segments.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = segments[mid];

    if (position < segment.virtualStart) high = mid - 1;
    else if (position >= segment.virtualEnd) low = mid + 1;
    else {
      if (segment.kind === 'outside') return undefined;

      return {
        offset:
          segment.kind === 'verbatim'
            ? segment.originalStart + position - segment.virtualStart
            : segment.originalStart,
        segment,
      };
    }
  }

  return undefined;
}
