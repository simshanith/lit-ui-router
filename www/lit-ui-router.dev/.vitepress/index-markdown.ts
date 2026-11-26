import type { FacetLink } from './theme/components/faceted-index.ts';

/** Inline code. */
export const code = (text: string): string => `\`${text}\``;

/** A link VitePress's client router must not take (a worker page or a static app): the HTML gets `target="_self"`, the Markdown copies a plain link. */
const selfLink = (text: string, href: string): string =>
  `<llm-exclude>[${text}](${href}){target="_self"}</llm-exclude><llm-only>[${text}](${href})</llm-only>`;

/** Renders a `FacetLink` as Markdown, using `selfLink` when VitePress's client router must not intercept it. */
export const markdownLink = ({ text, href, self }: FacetLink): string =>
  self ? selfLink(text, href) : `[${text}](${href})`;

/** Drops the Markdown-only halves, for renderers that never meet the llms plugin. */
export const stripLlmOnly = (markdown: string): string =>
  markdown.replace(/<llm-only>[\s\S]*?<\/llm-only>/g, '');

/** Keeps only the plain Markdown half of `selfLink`, so output can sit inside an outer `<llm-only>` block without nesting. */
export const plainLlmMarkdown = (markdown: string): string =>
  markdown
    .replace(/<llm-exclude>[\s\S]*?<\/llm-exclude>/g, '')
    .replace(/<\/?llm-only>/g, '');
