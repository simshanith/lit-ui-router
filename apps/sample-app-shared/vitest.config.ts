import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { defineConfig } from 'vitest/config';
import { GithubActionsReporter, type BrowserCommand } from 'vitest/node';
import { playwright } from '@vitest/browser-playwright';

interface CollectedRequest {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

interface Collector {
  server: Server;
  requests: CollectedRequest[];
}

// One per project, since the browser instances of a run share this module.
const collectors = new Map<string, Collector>();

// An OTLP/HTTP receiver on the test host; the page is another origin, so it answers CORS preflights.
const startOtlpCollector: BrowserCommand = async ({ project }) => {
  const requests: CollectedRequest[] = [];

  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];

    response.setHeader('access-control-allow-origin', '*');
    response.setHeader('access-control-allow-headers', '*');
    response.setHeader('access-control-allow-methods', 'POST');
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      if (request.method === 'POST') {
        requests.push({
          headers: request.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      }

      response.writeHead(request.method === 'POST' ? 200 : 204);
      response.end(request.method === 'POST' ? '{}' : undefined);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  collectors.set(project.name, { server, requests });

  // SAFETY: a server listening on a TCP port reports an AddressInfo
  const { port } = server.address() as AddressInfo;

  return `http://127.0.0.1:${port}/v1/traces`;
};

const takeOtlpRequests: BrowserCommand = ({ project }) =>
  collectors.get(project.name)?.requests.splice(0) ?? [];

const stopOtlpCollector: BrowserCommand = async ({ project }) => {
  const collector = collectors.get(project.name);

  collectors.delete(project.name);
  await new Promise<void>((resolve) =>
    collector ? collector.server.close(() => resolve()) : resolve(),
  );
};

export default defineConfig({
  cacheDir: `node_modules/.vite-${process.env.VITEST_BROWSER_API_PORT ?? 'default'}`,
  test: {
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // github-actions precedes the failure banner; hanging-process logs open handles in CI
    reporters: [
      ...(process.env.GITHUB_ACTIONS === 'true'
        ? [new GithubActionsReporter({ jobSummary: { enabled: false } })]
        : []),
      'default',
      ...(process.env.CI ? (['hanging-process'] as const) : []),
    ],
    api: process.env.VITEST_BROWSER_API_PORT
      ? { port: Number(process.env.VITEST_BROWSER_API_PORT) }
      : undefined,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      commands: { startOtlpCollector, takeOtlpRequests, stopOtlpCollector },
      instances: [
        {
          name: 'chrome',
          browser: 'chromium',
          headless: true,
        },
        {
          name: 'firefox',
          browser: 'firefox',
          headless: true,
        },
        {
          name: 'safari',
          browser: 'webkit',
          headless: true,
        },
      ],
    },
  },
});
