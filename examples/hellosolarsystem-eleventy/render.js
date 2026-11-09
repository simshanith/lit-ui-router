// Prerenders the built app into node_modules/.build/site.json, under the base build.js recorded.
import { readFileSync, writeFileSync } from 'node:fs';

import { renderSite } from './node_modules/.build/server/prerender.js';

const base = JSON.parse(readFileSync('node_modules/.build/base.json', 'utf8'));

writeFileSync(
  'node_modules/.build/site.json',
  JSON.stringify(await renderSite(base)),
);
