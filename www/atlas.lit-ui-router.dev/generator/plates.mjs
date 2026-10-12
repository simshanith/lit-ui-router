// PLATES — the bare plates the frame audit, the photographs and the card
// pictures read: app/dist/plate/<num>/index.html, one per sheet, written by the
// prerender (app/prerender.ts) and served here over http so the lanes' cytoscape
// loads from cdnjs. The dir name is the manifest's cased num (3B, 7A, A2, 12i).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

/** Under the atlas dir: the built app, and the plates inside it. */
export const APP_DIST = 'app/dist';
export const PLATE_DIR = `${APP_DIST}/plate`;

/** Every plate's cased num, sorted; throws until `ship.mjs app` has written them. */
export function platesOf(atlasDir) {
  const dir = join(atlasDir, PLATE_DIR);
  if (!existsSync(dir)) throw new Error(`no ${PLATE_DIR}/ under ${atlasDir} — run ship.mjs app first`);
  return readdirSync(dir).filter((num) => existsSync(join(dir, num, 'index.html'))).sort();
}

/** The plates `--only <ids>` names, matched without regard to case. */
export function onlyPlates(nums, ids) {
  if (!ids) return nums;
  const wanted = new Set(ids.split(',').map((id) => id.toLowerCase()));
  return nums.filter((num) => wanted.has(num.toLowerCase()));
}

/** The served plate's url. */
export const plateUrl = (origin, num) => `${origin}/plate/${num}/`;

const TYPES = {
  '.css': 'text/css',
  '.glb': 'model/gltf-binary',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

/** A built tree, served from disk on a free port: `/` and every `…/` answer with `index`. */
export async function serveSet(dir, index = 'index.html') {
  const server = createServer((req, res) => {
    void (async () => {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://atlas').pathname);
      const file = normalize(join(dir, path.endsWith('/') ? `${path}${index}` : path));
      if (!file.startsWith(dir)) {
        res.writeHead(403).end('no');
        return;
      }
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404).end('not found');
      }
    })();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

/** The server's origin. */
export const originOf = (server) => `http://127.0.0.1:${String(server.address().port)}`;
