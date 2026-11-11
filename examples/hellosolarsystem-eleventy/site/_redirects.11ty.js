// The router's redirect verdicts as host rules, in the _redirects syntax Cloudflare and Netlify read.
export const data = {
  permalink: '_redirects',
  eleventyExcludeFromCollections: true,
};

export function render({ site }) {
  return site.redirectsFile;
}
