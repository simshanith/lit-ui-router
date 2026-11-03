import { definePrerender } from 'ui-router-server/vite';

import { log } from './prerender-logs.ts';

export default definePrerender(() => {
  log();

  throw new Error('prerender-logs-throw threw');
});
