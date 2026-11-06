import { defaultTreeAdapter, parseFragment } from 'parse5';
import type { DefaultTreeAdapterTypes } from 'parse5';

export type ChildNode = DefaultTreeAdapterTypes.ChildNode;

export type DocumentFragment = DefaultTreeAdapterTypes.DocumentFragment;

export type Element = DefaultTreeAdapterTypes.Element;

export type ParentNode = DefaultTreeAdapterTypes.ParentNode;

type Template = DefaultTreeAdapterTypes.Template;

const { isCommentNode, isElementNode, isTextNode } = defaultTreeAdapter;

/** The value of attribute `name` on `node`, or null when it is absent. */
export const getAttribute = (node: Element, name: string): string | null =>
  node.attrs.find((attr) => attr.name === name)?.value ?? null;

/** Whether `node` carries attribute `name`. */
export const hasAttribute = (node: Element, name: string): boolean =>
  node.attrs.some((attr) => attr.name === name);

/** Parses server-rendered markup as the HTML spec does, keeping comments and template contents. */
export const parseMarkup = (markup: string): DocumentFragment =>
  parseFragment(markup);

const isTemplate = (node: ChildNode): node is Template =>
  isElementNode(node) && 'content' in node;

const isShadowTemplate = (node: ChildNode): node is Template =>
  isTemplate(node) && hasAttribute(node, 'shadowrootmode');

/** A node's own child nodes; a template has none, its contents are a separate fragment. */
export const childNodes = (node: ParentNode): ChildNode[] => node.childNodes;

const shadowTemplate = (host: Element): Template => {
  const template = host.childNodes.find(isShadowTemplate);

  if (!template) throw new Error(`<${host.tagName}> has no shadow root`);

  return template;
};

/** The contents of `host`'s declarative shadow root, the `<template shadowrootmode>` among its children. */
export const shadowRoot = (host: Element): DocumentFragment =>
  shadowTemplate(host).content;

const SHADOW_ROOT_PREFIX = 'shadowroot';

/** Every `shadowroot*` attribute on `host`'s declarative shadow root template, by full name; throws when it has none. */
export const shadowRootAttributes = (
  host: Element,
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    shadowTemplate(host)
      .attrs.filter(({ name }) => name.startsWith(SHADOW_ROOT_PREFIX))
      .map(({ name, value }) => [name, value]),
  );

/** `host`'s child nodes less its declarative shadow root. */
export const lightChildren = (host: Element): ChildNode[] =>
  host.childNodes.filter((child) => !isShadowTemplate(child));

// Like querySelectorAll and textContent, the walk stops at every template: a shadow root is entered through shadowRoot().
function* descendants(node: ParentNode): Generator<ChildNode> {
  for (const child of node.childNodes) {
    yield child;

    if (isElementNode(child)) yield* descendants(child);
  }
}

type Attributes = Readonly<Record<string, string>>;

const matches = (node: ChildNode, tag: string, attributes: Attributes) =>
  isElementNode(node) &&
  node.tagName === tag &&
  Object.entries(attributes).every(
    ([name, value]) => getAttribute(node, name) === value,
  );

/** Every element named `tag` with these attribute values below `root`, in document order. */
export const elements = (
  root: ParentNode,
  tag: string,
  attributes: Attributes = {},
): Element[] =>
  [...descendants(root)].filter((node): node is Element =>
    matches(node, tag, attributes),
  );

/** The first element {@link elements} finds. */
export const element = (
  root: ParentNode,
  tag: string,
  attributes: Attributes = {},
): Element => {
  const [found] = elements(root, tag, attributes);

  if (!found) {
    throw new Error(
      `no <${tag}> with ${JSON.stringify(attributes)} in the markup`,
    );
  }

  return found;
};

/** The text below `node`, comments skipped. */
export const text = (node: ParentNode): string =>
  [...descendants(node)]
    .flatMap((child) => (isTextNode(child) ? [child.value] : []))
    .join('');

/** The data of every comment below `node`, in document order. */
export const comments = (node: ParentNode): string[] =>
  [...descendants(node)].flatMap((child) =>
    isCommentNode(child) ? [child.data] : [],
  );

/** A Lit SSR marker comment; `prefix` is whatever precedes `lit-`, such as a served-marker prefix. */
export type LitMarker =
  | { kind: 'open'; digest: string | null; prefix: string }
  | { kind: 'close'; prefix: string }
  | { kind: 'node'; index: number; prefix: string };

const MARKER = /^(.*?)(?:(\/)lit-part|lit-part(?: (\S+))?|lit-node (\d+))$/;

/** Reads a comment as a Lit marker: `lit-part [digest]`, `/lit-part` or `lit-node <n>`; null for any other node. */
export const litPart = (node: ChildNode): LitMarker | null => {
  const match = isCommentNode(node) ? MARKER.exec(node.data) : null;

  if (!match) return null;
  const [, prefix = '', close, digest, index] = match;

  if (close) return { kind: 'close', prefix };

  if (index !== undefined)
    return { kind: 'node', index: Number(index), prefix };

  return { kind: 'open', digest: digest ?? null, prefix };
};

export interface OutlineTreeOptions {
  /** Print each open marker's digest; `false` writes `{open *}` for any digest, so a template edit elsewhere doesn't churn the outline. */
  digests?: boolean;
}

const markerLabel = (
  marker: LitMarker,
  { digests = true }: OutlineTreeOptions,
): string => {
  if (marker.kind === 'node') return `${marker.prefix}{node ${marker.index}}`;

  if (marker.kind === 'close') return `${marker.prefix}{close}`;

  if (marker.digest === null) return `${marker.prefix}{open}`;

  return `${marker.prefix}{open ${digests ? marker.digest : '*'}}`;
};

// The mode, then every other shadowroot* attribute without its prefix; the legacy `shadowroot` only repeats the mode.
const shadowLine = (template: Template): string => {
  const options = template.attrs.flatMap(({ name, value }) => {
    if (!name.startsWith(SHADOW_ROOT_PREFIX)) return [];
    const option = name.slice(SHADOW_ROOT_PREFIX.length);

    if (option === '' || option === 'mode') return [];

    return [value === '' ? option : `${option}=${value}`];
  });

  return ['#shadow', getAttribute(template, 'shadowrootmode'), ...options].join(
    ' ',
  );
};

const tagLabel = (node: Element): string => {
  const attributes = node.attrs.map(({ name, value }) =>
    value === '' ? ` ${name}` : ` ${name}="${value}"`,
  );

  return `<${node.tagName}${attributes.join('')}>`;
};

const label = (node: ChildNode): string => {
  if (isElementNode(node)) return `<${node.tagName}>`;

  if (isCommentNode(node)) return `<!--${node.data}-->`;

  return isTextNode(node) ? node.value : node.nodeName;
};

/** One label per child node: `<tag>` for an element, `<!--data-->` for a comment, the value for text. */
export const outline = (node: ParentNode): string[] =>
  childNodes(node).map(label);

const treeLine = (
  node: ChildNode,
  options: OutlineTreeOptions,
): string | null => {
  if (isShadowTemplate(node)) return shadowLine(node);

  if (isElementNode(node)) return tagLabel(node);

  if (isTextNode(node)) {
    const trimmed = node.value.trim();

    return trimmed === '' ? null : JSON.stringify(trimmed);
  }

  const marker = litPart(node);

  if (marker) return markerLabel(marker, options);

  return isCommentNode(node) ? `<!--${node.data}-->` : node.nodeName;
};

function* treeLines(
  node: ParentNode,
  depth: number,
  options: OutlineTreeOptions,
): Generator<string> {
  const indent = '  '.repeat(depth);

  for (const child of node.childNodes) {
    const line = treeLine(child, options);

    if (line !== null) yield `${indent}${line}`;

    if (isTemplate(child)) yield* treeLines(child.content, depth + 1, options);
    else if (isElementNode(child)) yield* treeLines(child, depth + 1, options);
  }
}

/**
 * An indented outline of `node`'s subtree, one line per node: tags with
 * their attributes, `#shadow <mode> [options]` for a declarative shadow root, Lit
 * markers as `{open digest}`, `{open}`, `{close}` and `{node n}` after any
 * prefix, and text trimmed and quoted, with whitespace-only text left out.
 */
export const outlineTree = (
  node: ParentNode,
  options: OutlineTreeOptions = {},
): string[] => [...treeLines(node, 0, options)];
