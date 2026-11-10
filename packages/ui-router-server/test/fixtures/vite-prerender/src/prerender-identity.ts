import { prerender } from 'ui-router-server/prerender';
import { definePrerender } from 'ui-router-server/vite';

import { mounts } from './routes.ts';

// SAFETY: capture-prerender.ts stores the `prerender` node itself resolved here, in the worker too.
const { processPrerender } = globalThis as { processPrerender?: unknown };

export default definePrerender((site) =>
  prerender({
    ...site,
    mounts,
    paths: ['/'],
    render: () => `<p>one copy: ${String(prerender === processPrerender)}</p>`,
  }),
);
