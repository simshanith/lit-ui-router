import { prerender } from 'ui-router-server/prerender';
import { definePrerender } from 'ui-router-server/vite';

import { tag } from './element.ts';
import { mounts } from './routes.ts';

export default definePrerender((site) =>
  prerender({
    ...site,
    mounts,
    paths: ['/'],
    render: () => `<${tag}></${tag}>`,
  }),
);
