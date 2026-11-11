import { prerender, redirectPages } from 'ui-router-server/prerender';
import { definePrerender } from 'ui-router-server/vite';

import { keyedMounts } from './routes-keyed.ts';

export default definePrerender((site) =>
  prerender({
    ...site,
    mounts: keyedMounts,
    pathsIncludeBase: false,
    paths: ['/', '/about', '/legacy'],
    rules: redirectPages({ redirectsFile: true }),
    render: (verdict, { path }) =>
      site.shellHtml.replace(
        '<div id="root"></div>',
        `<div id="root"><p>${path} ${String(verdict.status ?? 200)}</p></div>`,
      ),
  }),
);
