// Lowers Lit `html` templates to a type-check block: each template becomes a
// comma expression of typed helper calls in place, so expressions keep their
// scope and control-flow narrowing, followed by an empty `html``` of the same
// type. Expression text is copied verbatim and mapped back span for span.
// Structural findings lower to `report` calls, so the same directive comments
// suppress them.
import {
  type DefaultTreeAdapterTypes as T,
  defaultTreeAdapter,
  html as parse5Html,
  parseFragment,
} from 'parse5';

import { attributeType } from './html-data.ts';
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

/** A binding expression; `callee` and `args` are set when it calls a name. */
export interface Binding extends Span {
  callee?: string;
  args?: Span[];
}

/** A tagged template in the source; `strings` has one more entry than `expressions`. */
export interface TemplateSite extends Span {
  tag: string;
  strings: Span[];
  expressions: Binding[];
}

export type Rule =
  | 'unknown-tag'
  | 'unknown-attribute'
  | 'attribute-binding'
  | 'attribute-value'
  | 'boolean-binding'
  | 'property-binding'
  | 'event-binding'
  | 'element-binding'
  | 'child-binding'
  | 'directive-binding'
  | 'expressionless-binding'
  | 'mixed-binding'
  | 'unclosed-tag'
  | 'unknown-slot'
  | 'missing-import'
  | 'property-type'
  | 'directive';

/**
 * `verbatim` maps position for position; `atom` maps every position to one
 * original offset; `outside` is untouched or wrapper code whose diagnostics
 * belong to the ordinary typecheck; `prelude` is ours and must stay clean.
 * `report` marks a `true` argument whose parameter type carries the message.
 */
export interface Segment {
  virtualStart: number;
  virtualEnd: number;
  originalStart: number;
  kind: 'verbatim' | 'atom' | 'outside' | 'prelude';
  rule?: Rule;
  report?: true;
}

/** Check code spliced in at `at`, reported at `originalStart`. */
export interface Insertion {
  at: number;
  text: string;
  originalStart: number;
  rule: Rule;
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

export interface LowerContext {
  locals?: LocalTag[];
  events?: LocalEvents[];
  /** Slot names of the tags the file can see. */
  slots?: ReadonlyMap<string, readonly string[]>;
  /** Whether a custom tag is defined in the program but not imported by the file. */
  missingImport?: (tag: string) => boolean;
  insertions?: Insertion[];
}

const MARKER = /\$ltc(\d+)\$/g;

const marker = (i: number) => `$ltc${i}$`;

const DIRECTIVE_COMMENT = /^\s*@ts-(expect-error|ignore)\b/;

// lit-analyzer's typo tails: `attr=${x}'`, `attr=${x}}`, `attr=${x}/`
const MIXED_TAILS = new Set(["'", '"', '}', '/']);

const TEXT_ONLY_DIRECTIVES = new Set([
  'unsafeHTML',
  'unsafeSVG',
  'cache',
  'repeat',
  'templateContent',
  'asyncReplace',
  'asyncAppend',
]);

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
    report?: boolean,
  ): void {
    if (text.length === 0) return;

    const segment: Segment = {
      virtualStart: this.text.length,
      virtualEnd: this.text.length + text.length,
      originalStart,
      kind,
    };

    if (rule) segment.rule = rule;

    if (report) segment.report = true;
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
  '.': {
    fn: 'prop',
    rule: 'property-binding',
    kind: 'property',
    bare: 'You are using a property binding without an expression',
  },
  '?': {
    fn: 'bool',
    rule: 'boolean-binding',
    kind: 'boolean',
    bare: 'You are using a boolean attribute binding without an expression',
  },
  '@': {
    fn: 'on',
    rule: 'event-binding',
    kind: 'event',
    bare: 'You are using an event listener binding without an expression',
  },
} as const;

type BindingKind =
  | (typeof BINDINGS)[keyof typeof BINDINGS]['kind']
  | 'attribute';

const isBindingPrefix = (prefix: string): prefix is keyof typeof BINDINGS =>
  Object.hasOwn(BINDINGS, prefix);

const markerIndexes = (text: string) =>
  [...text.matchAll(MARKER)].map(([, index]) => Number(index));

/** The one expression index of a value that is exactly one binding. */
const single = (value: string): number | undefined => {
  const indexes = markerIndexes(value);

  return indexes.length === 1 && value.trim() === marker(indexes[0])
    ? indexes[0]
    : undefined;
};

const isMixedTypo = (value: string): boolean => {
  const [index, ...rest] = markerIndexes(value);

  return (
    index !== undefined &&
    rest.length === 0 &&
    value.startsWith(marker(index)) &&
    MIXED_TAILS.has(value.slice(marker(index).length))
  );
};

const isUnclosed = (node: T.Element): boolean => {
  const location = node.sourceCodeLocation;

  if (!location || location.endTag) return false;

  const children =
    node.tagName === 'template'
      ? // SAFETY: parse5 builds every HTML <template> with its content fragment
        (node as T.Template).content.childNodes
      : node.childNodes;

  // lit-analyzer's self-closed: no children, and nothing after the start tag
  return !(
    children.length === 0 && location.startTag?.endOffset === location.endOffset
  );
};

interface Attribute {
  name: string;
  value: string;
  nameAt: number;
  /** No `=` at all, as in `<input disabled>`. */
  valueless: boolean;
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
  readonly context: LowerContext;
  #site!: TemplateSite;
  #markup!: Markup;
  #placed = new Set<number>();
  #pendingDirective: { text: string; at: number } | undefined;

  constructor(source: string, sites: TemplateSite[], context: LowerContext) {
    this.source = source;
    this.sites = sites;
    this.context = context;
  }

  /** Copies [start, end) verbatim, lowering every outermost site and splicing insertions inside it. */
  range(start: number, end: number, kind: 'verbatim' | 'outside', rule?: Rule) {
    let cursor = start;

    const items = [
      ...this.sites
        .filter((site) => site.start >= start && site.end <= end)
        .map((site) => ({ at: site.start, site })),
      ...(this.context.insertions ?? [])
        .filter((insertion) => insertion.at >= start && insertion.at < end)
        .map((insertion) => ({ at: insertion.at, insertion })),
    ].sort((a, b) => a.at - b.at);

    for (const item of items) {
      if (item.at < cursor) continue;
      this.out.push(this.source.slice(cursor, item.at), kind, cursor, rule);
      cursor = item.at;

      if ('site' in item) {
        this.template(item.site);
        cursor = item.site.end;
      } else {
        const { text, originalStart, rule: checkRule } = item.insertion;
        this.out.push(text, 'atom', originalStart, checkRule, true);
      }
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
    this.nodes(fragment.childNodes, false, undefined);

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

  /** A second, unlowered copy of an argument, reported at its start. */
  copy(span: Span, rule: Rule): void {
    this.out.push(
      `(${this.source.slice(span.start, span.end)})`,
      'atom',
      span.start,
      rule,
    );
  }

  children(text: string, stat: Record<string, number>, key: string): void {
    for (const index of markerIndexes(text)) {
      bump(stat, key);
      this.call('child', () => this.expression(index, 'child-binding'));
    }
  }

  nodes(nodes: T.ChildNode[], svg: boolean, parent: string | undefined): void {
    for (const node of nodes) {
      if (defaultTreeAdapter.isCommentNode(node)) {
        this.comment(node);
      } else if (defaultTreeAdapter.isTextNode(node)) {
        this.children(node.value, this.stats.lowered, 'child');
      } else if (defaultTreeAdapter.isElementNode(node)) {
        const inSvg = svg || node.namespaceURI === parse5Html.NS.SVG;
        this.element(node, inSvg, parent);

        const template =
          node.tagName === 'template' &&
          node.namespaceURI === parse5Html.NS.HTML;

        this.nodes(
          // SAFETY: parse5 builds every HTML <template> with its content fragment
          template ? (node as T.Template).content.childNodes : node.childNodes,
          inSvg,
          node.tagName,
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
  directive(span: Binding): void {
    if (span.callee) bump(this.stats.directives, span.callee);
  }

  call(fn: string, args: () => void): void {
    this.out.push(`${NS}.${fn}(`, 'outside');
    args();
    this.out.push('), ', 'outside');
  }

  literal(text: string, at: number, rule: Rule): void {
    this.out.push(JSON.stringify(text), 'atom', at, rule);
  }

  /** A finding the lowering knows about; the parameter type carries its message. */
  report(at: number, rule: Rule, message: string): void {
    bump(this.stats.lowered, `report:${rule}`);
    this.out.push(
      `${NS}.report<${JSON.stringify(message)}>(true), `,
      'atom',
      at,
      rule,
      true,
    );
  }

  /** One line per element, so a directive comment covers all of its checks. */
  element(node: T.Element, svg: boolean, parent: string | undefined): void {
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

    if (!/\$ltc\d+\$/.test(tag)) this.structure(node, tagAt, parent);

    for (const { name, value } of node.attrs) {
      const attrLocation = this.attributeLocation(node, name);

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
          valueless: !raw.includes('='),
        },
        svg,
        ref,
        tag,
      );
    }
  }

  attributeLocation(node: T.Element, name: string) {
    const attrs = node.sourceCodeLocation?.attrs;

    return attrs?.[name] ?? attrs?.[name.toLowerCase()];
  }

  /** Unclosed tags, missing imports and slot names, as lit-analyzer reports them. */
  structure(node: T.Element, tagAt: number, parent: string | undefined): void {
    const tag = node.tagName;
    const custom = tag.includes('-');

    if (isUnclosed(node)) {
      this.report(
        tagAt,
        'unclosed-tag',
        `This tag isn't closed.${custom ? ' Custom elements cannot be self closing.' : ''}`,
      );
    }

    if (custom && this.context.missingImport?.(tag)) {
      this.report(tagAt, 'missing-import', `Missing import for <${tag}>`);
    }

    if (parent !== undefined) this.slotName(node, tagAt, parent);
  }

  /** A child's `slot` against the `@slot` names of its parent, if it declares any. */
  slotName(node: T.Element, tagAt: number, parent: string): void {
    const slots = this.context.slots?.get(parent);

    if (!slots || slots.length === 0) return;
    const slot = node.attrs.find((attr) => attr.name === 'slot');

    if (!slot) {
      if (!slots.includes('')) {
        this.report(
          tagAt,
          'unknown-slot',
          `Missing slot attribute. Parent element <${parent}> only allows named slots as children.`,
        );
      }
    } else if (
      markerIndexes(slot.value).length === 0 &&
      !slots.includes(slot.value)
    ) {
      const at = this.attributeLocation(node, 'slot')?.startOffset;
      const names = slots.map((name) => `'${name}'`).join(' | ');

      this.report(
        at === undefined ? tagAt : this.#markup.toSource(at),
        'unknown-slot',
        `Invalid slot name '${slot.value}'. Valid slot names for <${parent}> are: ${names}`,
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

  attribute(
    attribute: Attribute,
    svg: boolean,
    ref: () => void,
    tag: string,
  ): void {
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

      for (const index of markerIndexes(value)) {
        bump(this.stats.lowered, 'attribute');
        this.call('primitive', () =>
          this.expression(index, 'attribute-binding'),
        );
      }

      return;
    }

    bump(this.stats.lowered, 'attribute-name');
    this.call('attr', () => {
      ref();
      this.out.push(', ', 'outside');
      this.literal(name.toLowerCase(), nameAt, 'unknown-attribute');
    });
    this.attributeValue(attribute, ref, tag);
  }

  /** The value against the attribute's type: a custom element's property, else the html data's. */
  attributeValue(attribute: Attribute, ref: () => void, tag: string): void {
    const { name, value, nameAt, valueless } = attribute;
    const lower = name.toLowerCase();
    const fallback = attributeType(tag, lower);
    const typed = tag.includes('-') || fallback !== undefined;
    const index = single(value);
    const indexes = markerIndexes(value);

    const check = (fn: string, at: number, value?: () => void) => {
      this.call(fn, () => {
        ref();
        this.out.push(', ', 'outside');
        this.literal(lower, nameAt, 'attribute-value');
        this.out.push(', ', 'outside');

        if (value) {
          value();
          this.out.push(', ', 'outside');
        }

        this.out.push('true', 'atom', at, 'attribute-value', true);

        if (fallback !== undefined) {
          this.out.push(`, ${NS}.as<${fallback}>()`, 'outside');
        }
      });
    };

    if (index !== undefined) {
      bump(this.stats.lowered, 'attribute');
      const binding = this.#site.expressions[index];
      check('value', binding.start, () =>
        this.expression(index, 'attribute-binding'),
      );
      this.directiveChecks('attribute', lower, index, nameAt);

      // live() hides its argument's type in a directive result
      const [arg] = binding.args ?? [];

      if (typed && arg && binding.callee === 'live') {
        check('valueOf', arg.start, () => this.copy(arg, 'attribute-value'));
      }
    } else if (indexes.length > 0) {
      if (isMixedTypo(value)) {
        this.report(nameAt, 'mixed-binding', mixedMessage(value.slice(-1)));
      }

      for (const part of indexes) {
        bump(this.stats.lowered, 'attribute');
        this.call('primitive', () =>
          this.expression(part, 'attribute-binding'),
        );
      }

      if (typed) {
        check('value', nameAt, () =>
          this.out.push(`${NS}.text`, 'atom', nameAt, 'attribute-value'),
        );
      }
    } else if (typed) {
      bump(this.stats.lowered, 'attribute-value');

      if (valueless) check('present', nameAt);
      else {
        check('value', nameAt, () =>
          this.literal(value, nameAt, 'attribute-value'),
        );
      }
    }
  }

  /** lit-analyzer's no-invalid-directive-binding, by the directive's name. */
  directiveChecks(
    kind: BindingKind,
    name: string,
    index: number,
    at: number,
  ): void {
    const binding = this.#site.expressions[index];
    const callee = binding.callee;

    if (callee === undefined) return;

    if (callee === 'ifDefined') {
      if (binding.args?.length === 1 && kind !== 'attribute') {
        this.report(
          at,
          'directive-binding',
          "The 'ifDefined' directive has no effect here.",
        );
      }
    } else if (callee === 'live') {
      this.live(kind, binding, at);
    } else if (callee === 'classMap' || callee === 'styleMap') {
      const attribute = callee === 'classMap' ? 'class' : 'style';

      if (kind !== 'attribute' || name !== attribute) {
        this.report(
          at,
          'directive-binding',
          `The '${callee}' directive can only be used in an attribute binding for the '${attribute}' attribute`,
        );
      }
    } else if (TEXT_ONLY_DIRECTIVES.has(callee)) {
      this.report(
        at,
        'directive-binding',
        `The '${callee}' directive can only be used within a text binding.`,
      );
    }
  }

  live(kind: BindingKind, binding: Binding, at: number): void {
    const [arg] = binding.args ?? [];

    if (kind === 'event') {
      this.report(
        at,
        'directive-binding',
        "The 'live' directive can only be used in attribute and property bindings",
      );
    } else if (kind === 'attribute' && arg) {
      this.out.push(`${NS}.live(`, 'outside');
      this.copy(arg, 'directive-binding');
      this.out.push(', ', 'outside');
      this.out.push('true', 'atom', at, 'directive-binding', true);
      this.out.push('), ', 'outside');
    }
  }

  binding(
    { name, value, nameAt }: Attribute,
    prefix: keyof typeof BINDINGS,
    ref: () => void,
  ): void {
    const { fn, rule, kind, bare: bareMessage } = BINDINGS[prefix];
    const bare = name.slice(1);
    const bound = prefix === '?' ? bare.toLowerCase() : bare;
    const indexes = markerIndexes(value);
    const index = single(value);

    if (indexes.length === 0) {
      bump(this.stats.skipped, `${prefix}binding-expressionless`);
      this.report(nameAt, 'expressionless-binding', bareMessage);

      return;
    }

    if (index === undefined) {
      bump(this.stats.skipped, `${prefix}binding-interpolated`);

      if (prefix !== '@') {
        if (isMixedTypo(value)) {
          this.report(nameAt, 'mixed-binding', mixedMessage(value.slice(-1)));
        }

        // an interpolated value reaches the element as a string
        this.call(fn, () => {
          ref();
          this.out.push(', ', 'outside');
          this.literal(bound, nameAt + 1, rule);
          this.out.push(', ', 'outside');
          this.out.push(`${NS}.text`, 'atom', nameAt, rule);
        });
      }

      this.children(value, this.stats.skipped, 'interpolated-part');

      return;
    }

    bump(this.stats.lowered, kind);
    this.call(fn, () => {
      ref();
      this.out.push(', ', 'outside');
      this.literal(bound, nameAt + 1, rule);
      this.out.push(', ', 'outside');
      this.expression(index, rule);
    });
    this.directiveChecks(kind, bound, index, nameAt);
  }
}

const mixedMessage = (tail: string): string =>
  tail === '/'
    ? "This binding is directly followed by a '/' which is probably unintended."
    : `This binding is directly followed by an unmatched ${tail === "'" ? `"'"` : `'${tail}'`} which is probably unintended.`;

export function lowerFile(
  source: string,
  sites: TemplateSite[],
  litModule: string,
  context: LowerContext = {},
): Lowered {
  const sorted = [...sites].sort((a, b) => a.start - b.start);
  const lowerer = new FileLowerer(source, sorted, context);
  lowerer.range(0, source.length, 'outside');
  lowerer.out.push(
    prelude(litModule, context.locals, context.events),
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
