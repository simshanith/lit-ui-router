// A page per redirect for hosts that skip _redirects, such as a static file server or the docs embed.
const under = (base, path) => `${base}${path.replace(/^\//, '')}`;

export const data = {
  pagination: {
    data: 'site.rules',
    size: 1,
    alias: 'rule',
    before: (rules) =>
      rules.filter((r) => !r.from.endsWith('/') || r.from === '/'),
  },
  permalink: (data) =>
    `${data.rule.from.replace(/^\/|\/$/g, '')}/index.html`.replace(/^\//, ''),
  layout: 'base.11ty.js',
  eleventyComputed: { redirect: (data) => under(data.base, data.rule.to) },
};

export function render({ redirect }) {
  return `<p>Moved to <a href="${redirect}">${redirect}</a>.</p>`;
}
