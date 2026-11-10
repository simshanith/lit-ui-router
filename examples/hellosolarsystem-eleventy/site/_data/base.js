// The path the site is served under: `/`, or `/examples/<name>/` in the docs site, as build.js recorded it.
import { readFileSync } from 'node:fs';

export default JSON.parse(
  readFileSync(
    new URL('../../node_modules/.build/base.json', import.meta.url),
    'utf8',
  ),
);
