// A page per redirect for hosts that skip _redirects, such as a static file server or the docs embed.
export const data = {
  pagination: { data: 'site.redirects', size: 1, alias: 'entry' },
  permalink: (data) => data.entry.file,
  layout: 'base.11ty.js',
  eleventyComputed: { redirect: (data) => data.entry.to },
};

export function render({ redirect }) {
  return `<p>Moved to <a href="${redirect}">${redirect}</a>.</p>`;
}
