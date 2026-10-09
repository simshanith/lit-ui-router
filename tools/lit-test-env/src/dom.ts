// Adapted from getDiffableHTML in @open-wc/semantic-dom-diff 0.21.0
// (get-diffable-html.js), Copyright (c) 2018 open-wc, MIT.
// Reworked for vitest: a recursive walk, attributes inline, whitespace runs
// collapsed, template parsing for strings, and optional shadow roots.
import type {
  MatcherState,
  SnapshotSerializer,
  SyncMatcherResult,
} from 'vitest';

export interface IgnoreAttributesForTags {
  tags: string[];
  attributes: string[];
}

export interface DomDiffOptions {
  /** Attributes to drop: a string on every tag, an object on the named tags. */
  ignoreAttributes?: (string | IgnoreAttributesForTags)[];
  /** Tags dropped with their subtree, on top of script, style and svg. */
  ignoreTags?: string[];
  /** Tags printed without their children. */
  ignoreChildren?: string[];
  /** Attributes dropped when blank; defaults to class and id. Never a boolean attribute. */
  stripEmptyAttributes?: string[];
  /** Print each open shadow root as a `#shadow-root` line ahead of the light DOM. */
  shadowRoots?: boolean;
}

const DEFAULT_IGNORE_TAGS = ['script', 'style', 'svg'];
const DEFAULT_EMPTY_ATTRS = ['class', 'id'];
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'menuitem',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;
const DOCUMENT_FRAGMENT_NODE = 11;

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();

interface Printer {
  children(parent: Node, depth: number): void;
  element(el: Element, depth: number): void;
  lines: string[];
}

function createPrinter(options: DomDiffOptions): Printer {
  const ignoreAttributes = options.ignoreAttributes ?? [];
  const ignoreEverywhere = new Set(
    ignoreAttributes.filter((e): e is string => typeof e === 'string'),
  );
  const ignoreForTags = ignoreAttributes.filter(
    (e): e is IgnoreAttributesForTags => typeof e !== 'string',
  );
  const ignoreTags = new Set([
    ...(options.ignoreTags ?? []),
    ...DEFAULT_IGNORE_TAGS,
  ]);
  const ignoreChildren = new Set(options.ignoreChildren ?? []);
  const stripEmpty = new Set(
    options.stripEmptyAttributes ?? DEFAULT_EMPTY_ATTRS,
  );

  const lines: string[] = [];
  let pendingText = '';
  const indent = (depth: number) => '  '.repeat(depth);

  // Adjacent text joins across dropped comments, so lit's part markers vanish.
  function flushText(depth: number) {
    const value = collapse(pendingText);
    pendingText = '';
    if (value !== '') lines.push(`${indent(depth)}${value}`);
  }

  function isIgnoredAttribute(tag: string, { name, value }: Attr) {
    return (
      ignoreEverywhere.has(name) ||
      (stripEmpty.has(name) && value.trim() === '') ||
      ignoreForTags.some(
        (e) => e.tags.includes(tag) && e.attributes.includes(name),
      )
    );
  }

  function attributeString(el: Element, { name, value }: Attr) {
    const printed =
      name === 'class'
        ? [...el.classList].sort().join(' ')
        : value.replace(/[&"]/g, (m) => (m === '&' ? '&amp;' : '&quot;'));
    return ` ${name}="${printed}"`;
  }

  function attributesString(el: Element) {
    return Array.from(el.attributes)
      .filter((attr) => !isIgnoredAttribute(el.localName, attr))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((attr) => attributeString(el, attr))
      .join('');
  }

  function element(el: Element, depth: number) {
    const tag = el.localName;
    if (ignoreTags.has(tag)) return;
    lines.push(`${indent(depth)}<${tag}${attributesString(el)}>`);
    if (!ignoreChildren.has(tag)) {
      if (options.shadowRoots && el.shadowRoot) {
        lines.push(`${indent(depth + 1)}#shadow-root`);
        children(el.shadowRoot, depth + 2);
      }
      children(el, depth + 1);
    }
    if (!VOID_ELEMENTS.has(tag)) lines.push(`${indent(depth)}</${tag}>`);
  }

  function children(parent: Node, depth: number) {
    for (const child of parent.childNodes) {
      if (child.nodeType === TEXT_NODE) {
        pendingText += child.nodeValue ?? '';
      } else if (child.nodeType === ELEMENT_NODE) {
        flushText(depth);
        element(child as Element, depth);
      }
    }
    flushText(depth);
  }

  return { children, element, lines };
}

/**
 * Prints `html` one element or text run per indented line, for comparing as
 * a string: comments dropped, attributes and class tokens sorted, whitespace
 * collapsed, script/style/svg removed. An Element prints itself; a string,
 * Document, DocumentFragment or ShadowRoot prints its children.
 */
export function getDiffableHTML(
  html: Node | string,
  options: DomDiffOptions = {},
): string {
  const printer = createPrinter(options);
  if (typeof html === 'string') {
    // Template content stays disconnected: no connectedCallback runs.
    const template = document.createElement('template');
    template.innerHTML = html;
    printer.children(template.content, 0);
  } else if (html.nodeType === ELEMENT_NODE) {
    printer.element(html as Element, 0);
  } else if (
    html.nodeType === DOCUMENT_FRAGMENT_NODE ||
    html.nodeType === DOCUMENT_NODE
  ) {
    printer.children(html, 0);
  } else if (html.nodeType === TEXT_NODE) {
    return collapse(html.nodeValue ?? '');
  } else {
    throw new TypeError(`Cannot create diffable HTML from: ${html.nodeName}`);
  }
  return printer.lines.join('\n');
}

function isDiffable(value: unknown): value is Node | string {
  return (
    typeof value === 'string' ||
    (typeof Node !== 'undefined' && value instanceof Node)
  );
}

/** `expect.extend(domMatchers)` from the consuming suite's vitest.setup. */
export const domMatchers = {
  toEqualDom(
    this: MatcherState,
    received: unknown,
    expected: Node | string,
    options: DomDiffOptions = {},
  ): SyncMatcherResult {
    if (!isDiffable(received)) {
      throw new TypeError(
        `toEqualDom expects a Node or an HTML string, received ${this.utils.stringify(received)}`,
      );
    }
    const actual = getDiffableHTML(received, options);
    const want = getDiffableHTML(expected, options);
    const pass = actual === want;
    return {
      pass,
      actual,
      expected: want,
      message: () =>
        pass
          ? `expected DOM not to equal:\n${want}`
          : 'expected DOM to equal (semantic diff)',
    };
  },
};

/** `expect.addSnapshotSerializer(domSnapshotSerializer)`: Elements print diffable. */
export const domSnapshotSerializer: SnapshotSerializer = {
  test: (value: unknown) =>
    typeof Element !== 'undefined' && value instanceof Element,
  serialize: (value: Element) => getDiffableHTML(value),
};

declare module 'vitest' {
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > {
    /** Compares both sides as {@link getDiffableHTML} prints them. */
    toEqualDom: (expected: Node | string, options?: DomDiffOptions) => R;
  }
}
