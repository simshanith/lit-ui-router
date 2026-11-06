export const data = {
  pagination: { data: 'routes', size: 1, alias: 'route' },
  permalink: (data) => data.route.permalink,
  layout: 'base.11ty.js',
  eleventyComputed: {
    title: (data) => `Hello Solar System on Eleventy (${data.route.path})`,
  },
};

export function render({ route, base }) {
  if (route.kind === 'redirect') {
    const to = `${base}${route.location.replace(/^\//, '')}`;

    return `<p>Moved to <a href="${to}">${to}</a>.</p>`;
  }

  return `<div id="app" data-status="${route.status}">${route.body}</div>`;
}
