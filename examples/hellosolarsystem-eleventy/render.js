// Prerenders the built app into node_modules/.build/site.json, under the base path passed as the first argument.
import { writeFileSync } from 'node:fs';

import { renderSite } from './node_modules/.build/server/prerender.js';

writeFileSync(
  'node_modules/.build/site.json',
  JSON.stringify(await renderSite(process.argv[2])),
);
