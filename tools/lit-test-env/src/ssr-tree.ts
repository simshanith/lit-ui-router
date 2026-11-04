import {
  getAttribute,
  hasAttribute,
  isCommentNode,
  isElementNode,
  isParentNode,
  isTemplateNode,
  isTextNode,
} from '@parse5/tools';
import type {
  ChildNode,
  DocumentFragment,
  Element,
  ParentNode,
} from '@parse5/tools';
import { parseFragment } from 'parse5';

export { getAttribute, hasAttribute };

export type { ChildNode, DocumentFragment, Element, ParentNode };

/** Parses server-rendered markup as the HTML spec does, keeping comments and template contents. */
export const parseMarkup = (markup: string): DocumentFragment =>
  parseFragment(markup);

/** A node's children; a template's are its content's. */
export const childNodes = (node: ParentNode): ChildNode[] =>
  isTemplateNode(node) ? node.content.childNodes : node.childNodes;

function* descendants(node: ParentNode): Generator<ChildNode> {
  for (const child of childNodes(node)) {
    yield child;

    if (isParentNode(child)) yield* descendants(child);
  }
}

type Attributes = Readonly<Record<string, string>>;

const matches = (node: ChildNode, tag: string, attributes: Attributes) =>
  isElementNode(node) &&
  node.tagName === tag &&
  Object.entries(attributes).every(
    ([name, value]) => getAttribute(node, name) === value,
  );

/** Every element named `tag` with these attribute values below `root`, in document order, template contents included. */
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

/** The text below `node`, template contents included and comments skipped. */
export const text = (node: ParentNode): string =>
  [...descendants(node)]
    .flatMap((child) => (isTextNode(child) ? [child.value] : []))
    .join('');

/** The data of every comment below `node`, in document order. */
export const comments = (node: ParentNode): string[] =>
  [...descendants(node)].flatMap((child) =>
    isCommentNode(child) ? [child.data] : [],
  );

const label = (node: ChildNode): string => {
  if (isElementNode(node)) return `<${node.tagName}>`;

  if (isCommentNode(node)) return `<!--${node.data}-->`;

  return isTextNode(node) ? node.value : node.nodeName;
};

/** One label per child node: `<tag>` for an element, `<!--data-->` for a comment, the value for text. */
export const outline = (node: ParentNode): string[] =>
  childNodes(node).map(label);
