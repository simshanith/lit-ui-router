// Serves the built docs site as production does, without wrangler: the real worker module behind a dist-backed assets binding.

import { readFile, stat } from 'node:fs/promises';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { extname, join, normalize, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  assetCandidates,
  runsWorkerFirst,
  workerFirstPatterns,
} from './site.core.ts';

const CONTENT_TYPES = new Map([
  ['.css', 'text/css'],
  ['.gif', 'image/gif'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript'],
  ['.json', 'application/json'],
  ['.map', 'application/json'],
  ['.mjs', 'text/javascript'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml'],
]);

interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

/** The slice of the docs worker's default export this server calls. */
interface DocsWorker {
  fetch(request: Request, env: { ASSETS: AssetsBinding }): Promise<Response>;
}

async function fileAt(dist: string, path: string): Promise<string | null> {
  const file = normalize(join(dist, decodeURIComponent(path)));

  if (!file.startsWith(dist + sep)) return null;

  try {
    return (await stat(file)).isFile() ? file : null;
  } catch {
    return null;
  }
}

async function fileResponse(
  file: string,
  status: number,
  method: string,
): Promise<Response> {
  const headers = {
    'content-type':
      CONTENT_TYPES.get(extname(file)) ?? 'application/octet-stream',
  };

  return new Response(method === 'HEAD' ? null : await readFile(file), {
    status,
    headers,
  });
}

/** dist-backed assets binding with `404-page` not-found handling. */
function assetsBinding(dist: string): AssetsBinding {
  return {
    async fetch(request) {
      const { pathname } = new URL(request.url);

      for (const candidate of assetCandidates(pathname)) {
        const file = await fileAt(dist, candidate);

        if (file) return fileResponse(file, 200, request.method);
      }

      const notFound = await fileAt(dist, '/404.html');

      return notFound
        ? fileResponse(notFound, 404, request.method)
        : new Response('not found', { status: 404 });
    },
  };
}

function toRequest(req: IncomingMessage, origin: string): Request {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;

    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item);
    }
  }

  return new Request(new URL(req.url ?? '/', origin), {
    method: req.method,
    headers,
  });
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export interface Site {
  origin: string;
  close(): void;
}

/** Serves `<siteDir>/dist` through `<siteDir>/worker/index.ts` on a free port. */
export async function serveSite(siteDir: string): Promise<Site> {
  const dist = join(siteDir, 'dist');

  const patterns = workerFirstPatterns(
    await readFile(join(siteDir, 'wrangler.jsonc'), 'utf8'),
  );

  const workerUrl = pathToFileURL(join(siteDir, 'worker', 'index.ts')).href;

  // SAFETY: worker/index.ts default-exports an ExportedHandler whose fetch takes ASSETS
  const { default: worker } = (await import(workerUrl)) as {
    default: DocsWorker;
  };

  const env = { ASSETS: assetsBinding(dist) };

  let origin = '';

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        const request = toRequest(req, origin);
        const { pathname } = new URL(request.url);
        await send(
          res,
          runsWorkerFirst(patterns, pathname)
            ? await worker.fetch(request, env)
            : await env.ASSETS.fetch(request),
        );
      } catch (error) {
        console.error(error);
        res.writeHead(500).end('site server error');
      }
    })();
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  // SAFETY: a server listening on a TCP port reports an AddressInfo, not a pipe name
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  return { origin, close: () => server.close() };
}
