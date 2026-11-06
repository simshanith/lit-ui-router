// One render per router path, all at once: Eleventy owns the pages, the router decides what each one is.
import { paths } from '../../node_modules/.build/server/route-table.js';
import { renderRoute } from '../../node_modules/.build/server/render-route.js';

const permalinkOf = (path, status) =>
  status === 404
    ? '404.html'
    : `${path.replace(/^\/|\/$/g, '')}/index.html`.replace(/^\//, '');

export default async function () {
  const rendered = await Promise.all(
    paths.map(async (path) => ({ path, ...(await renderRoute(path)) })),
  );

  return rendered.map((r) => ({
    ...r,
    permalink: permalinkOf(r.path, r.status),
  }));
}
