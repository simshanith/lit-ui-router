import { prerender } from 'ui-router-server/prerender';
import { definePrerender } from 'ui-router-server/vite';

import { mounts } from './routes.ts';

// SAFETY: build-identity.ts stores the process's own `prerender` here before the build.
const { processPrerender } = globalThis as { processPrerender?: unknown };

export default definePrerender((site) =>
  prerender({
    ...site,
    mounts,
    paths: ['/'],
    render: () => `<p>one copy: ${String(prerender === processPrerender)}</p>`,
  }),
);
