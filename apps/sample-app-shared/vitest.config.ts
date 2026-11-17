import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { defineConfig } from 'vitest/config';
import { GithubActionsReporter, type BrowserCommand } from 'vitest/node';
import { playwright } from '@vitest/browser-playwright';

interface CollectedRequest {
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

const collected: CollectedRequest[] = [];

let collector: Server | undefined;

// An OTLP/HTTP receiver on the test host; the page is another origin, so it answers CORS preflights.
const startOtlpCollector: BrowserCommand = async () => {
  collector ??= createServer((request, response) => {
    const chunks: Buffer[] = [];

    response.setHeader('access-control-allow-origin', '*');
    response.setHeader('access-control-allow-headers', '*');
    response.setHeader('access-control-allow-methods', 'POST');
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      if (request.method === 'POST') {
        collected.push({
          headers: request.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      }

      response.writeHead(request.method === 'POST' ? 200 : 204);
      response.end(request.method === 'POST' ? '{}' : undefined);
    });
  });

  if (!collector.listening) {
    await new Promise<void>((resolve) =>
      collector?.listen(0, '127.0.0.1', resolve),
    );
  }

  // SAFETY: a server listening on a TCP port reports an AddressInfo
  const { port } = collector.address() as AddressInfo;

  return `http://127.0.0.1:${port}/v1/traces`;
};

const takeOtlpRequests: BrowserCommand = () => collected.splice(0);

const stopOtlpCollector: BrowserCommand = async () => {
  collected.length = 0;
  await new Promise<void>((resolve) =>
    collector?.listening ? collector.close(() => resolve()) : resolve(),
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
