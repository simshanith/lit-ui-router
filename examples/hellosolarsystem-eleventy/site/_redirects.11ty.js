// Host rules for the router's redirect verdicts, in the `_redirects` syntax Cloudflare and Netlify read.
export const data = {
  permalink: '_redirects',
  eleventyExcludeFromCollections: true,
};

const under = (base, path) => `${base}${path.replace(/^\//, '')}`;

export function render({ routes, base }) {
  return `${routes
    .filter((r) => r.kind === 'redirect')
    .map((r) => `${under(base, r.path)} ${under(base, r.location)} ${r.status}`)
    .join('\n')}\n`;
}
