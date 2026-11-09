// The router's redirect verdicts as host rules, in the _redirects syntax Cloudflare and Netlify read.
const under = (base, path) => `${base}${path.replace(/^\//, '')}`;

export const data = {
  permalink: '_redirects',
  eleventyExcludeFromCollections: true,
};

export function render({ site, base }) {
  return `${site.rules.map((r) => `${under(base, r.from)} ${under(base, r.to)} ${r.status}`).join('\n')}\n`;
}
