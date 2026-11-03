import { prerender } from 'ui-router-server/prerender';
import { definePrerender } from 'ui-router-server/vite';

import { mounts } from './routes.ts';

export const LOG_LINES = 200;

export const log = (): void => {
  for (let line = 0; line < LOG_LINES; line++) {
    console.log(`stdout line ${String(line)}`);
    console.error(`stderr line ${String(line)}`);
  }
};

export default definePrerender(async (site) => {
  const result = await prerender({
    ...site,
    mounts,
    paths: ['/'],
    render: () => '<p>logs</p>',
  });

  log();

  return result;
});
