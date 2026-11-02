import type { PrerenderEntry } from 'ui-router-server/vite';
import { prerender } from 'ui-router-server/prerender';

import { mounts } from './routes.ts';

const entry: PrerenderEntry = (build) =>
  prerender({
    ...build,
    mounts,
    paths: ['/', '/about', '/legacy'],
    render: (verdict, { path }) =>
      build.template.replace(
        '<div id="root"></div>',
        `<div id="root"><p>${path} ${String(verdict.status ?? 200)}</p></div>`,
      ),
  });

export default entry;
