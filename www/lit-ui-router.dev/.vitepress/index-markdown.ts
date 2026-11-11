/** Inline code. */
export const code = (text: string): string => `\`${text}\``;

/** A link VitePress's client router must not take (a worker page or a static app): the HTML gets `target="_self"`, the Markdown copies a plain link. */
export const selfLink = (text: string, href: string): string =>
  `<llm-exclude>[${text}](${href}){target="_self"}</llm-exclude><llm-only>[${text}](${href})</llm-only>`;

/** Drops the Markdown-only halves, for renderers that never meet the llms plugin. */
export const stripLlmOnly = (markdown: string): string =>
  markdown.replace(/<llm-only>[\s\S]*?<\/llm-only>/g, '');
