// Stage the atlas for static hosting: copy the rendered set into dist/ with
// the gallery doubled as index.html. Run from diagrams/: node generator/stage-site.mjs
// The pages are self-contained (inline CSS, fragment anchors only), so a flat
// copy relocates the whole set intact; deploy dist/ with any static host.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist);

const pages = readdirSync(root).filter((f) => f.endsWith('.html')).sort();
for (const f of pages) copyFileSync(join(root, f), join(dist, f));
copyFileSync(join(root, 'gallery.html'), join(dist, 'index.html'));

console.log(`staged ${pages.length} pages + index.html → dist/`);
