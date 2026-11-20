// Data only: the search index adds every other member of a group wherever one appears; .vitepress/search-aliases.ts tokenizes it.

/** Groups of names local search treats as one. */
export const SEARCH_ALIASES = [
  ['11ty', 'eleventy'],
  ['ui-view', 'uiview'],
  ['prerender', 'ssg'],
  ['ssr', 'server-side rendering'],
] as const;
