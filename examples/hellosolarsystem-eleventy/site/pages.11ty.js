export const data = {
  pagination: { data: 'site.pages', size: 1, alias: 'route' },
  permalink: (data) => data.route.file,
  layout: 'base.11ty.js',
};

export function render({ route }) {
  return `<div id="app" data-status="${route.status}">${route.body}</div>`;
}
