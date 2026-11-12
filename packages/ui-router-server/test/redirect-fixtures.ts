import assert from 'node:assert/strict';

import type { ConnectMiddleware, ConnectNext } from '../src/connect.ts';
import type { ServerRouter } from '../src/index.ts';
import type { FileWriter } from '../src/prerender.ts';
import { serverRouterPlugin } from '../src/vite.ts';

export const STRATEGIES = ['matcher', 'simulate'] as const;

export type Strategy = (typeof STRATEGIES)[number];

export const ORIGIN = 'https://site.test';

export const navigation = (url: string): Request =>
  new Request(`${ORIGIN}${url}`, { headers: { accept: 'text/html' } });

export const noShell = (): never => {
  throw new Error('serveShell must not be called');
};

/** What one run of a Connect middleware did: the head it wrote, or the `next` it called. */
interface ConnectOutcome {
  status?: number;
  location?: string;
  error?: unknown;
  next?: true;
}

// Runs Connect middleware once; answers the redirect it wrote.
export const connect = (
  middleware: ConnectMiddleware,
  url: string,
  method = 'GET',
): Promise<ConnectOutcome> =>
  new Promise((resolve) => {
    const res = {
      writeHead: (status: number, headers?: { Location?: string }) =>
        resolve({ status, location: headers?.Location }),
      setHeader: () => {},
      end: () => {},
    };

    const next: ConnectNext = (error) =>
      resolve(error === undefined ? { next: true } : { error });

    middleware({ url, method, headers: { accept: 'text/html' } }, res, next);
  });

// The middleware `vite preview` installs for the router, at Vite's `base`.
export const previewMiddleware = async (
  router: ServerRouter,
  base: string,
): Promise<ConnectMiddleware> => {
  const plugin = serverRouterPlugin(router);
  const installed: ConnectMiddleware[] = [];

  await plugin.configResolved({
    root: '/nonexistent',
    base,
    command: 'serve',
    mode: 'production',
    build: { outDir: 'dist', ssr: false },
    logger: { info: () => {} },
  });
  plugin.configurePreviewServer({
    middlewares: { use: (mw: ConnectMiddleware) => installed.push(mw) },
  });
  const [middleware] = installed;
  assert.ok(middleware);

  return middleware;
};

export const memory = () => {
  const files = new Map<string, string>();

  const write: FileWriter = (file, body) => {
    files.set(file, body);
  };

  return { files, write };
};
