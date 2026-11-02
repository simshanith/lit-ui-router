import { prerender } from 'ui-router-server/prerender';
import { definePrerender } from 'ui-router-server/vite';

import { mounts } from './routes.ts';

export default definePrerender((site) =>
  prerender({
    ...site,
    mounts,
    paths: ['/', '/about', '/legacy'],
    render: (verdict, { path }) =>
      site.shellHtml.replace(
        '<div id="root"></div>',
        `<div id="root"><p>${path} ${String(verdict.status ?? 200)}</p></div>`,
      ),
  }),
);
