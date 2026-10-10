#!/usr/bin/env node
// Runs axe-core over the served docs site and its sample-app mounts; any violation fails.
// Usage: check-a11y <origin> [--json]   (origin: the wrangler dev server, e.g. http://localhost:8787)

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { workspaceRoot } from '@tools/bootstrap/root.ts';
import { chromium } from 'playwright';

import {
  type AppMount,
  type Audit,
  auditApp,
  auditDocs,
  type Finding,
} from './audit.ts';
import { samplePages } from './pages.ts';
import { runsWorkerFirst, workerFirstPatterns } from './worker-first.ts';

const SITE_DIR = join(workspaceRoot, 'www/lit-ui-router.dev');

const DIST = join(SITE_DIR, 'dist');

/** The vanilla walk also turns on the api-docs panel and the visualizer. */
const APPS: readonly AppMount[] = [
  {
    mount: '/app',
    hash: false,
    query: '?feature-enable-api-docs=true&feature-enable-visualizer=true',
  },
  { mount: '/app-mobx', hash: false },
  { mount: '/app-effect', hash: false },
  { mount: '/app-hash', hash: true },
];

const args = process.argv.slice(2);

const asJson = args.includes('--json');

const origin = args.find((arg) => arg !== '--json');

function fail(message: string): never {
  console.error(`check-a11y: ${message}`);
  process.exit(1);
}

if (origin === undefined || !URL.canParse(origin)) {
  fail('usage: check-a11y <origin> [--json]');
}

/** Every built page as its clean URL. */
async function htmlPaths(): Promise<string[]> {
  const entries = await readdir(DIST, { recursive: true });

  return entries
    .filter((entry) => entry.endsWith('.html'))
    .map(
      (entry) => `/${relative(DIST, join(DIST, entry)).split(sep).join('/')}`,
    )
    .map((path) =>
      path.endsWith('/index.html')
        ? path.slice(0, -'index.html'.length)
        : path.slice(0, -'.html'.length),
    )
    .sort();
}

try {
  if (!(await stat(join(DIST, 'index.html'))).isFile()) throw new Error();
} catch {
  fail(
    'www/lit-ui-router.dev/dist is not built — run `turbo run build --filter=@www/lit-ui-router.dev`',
  );
}

// Mount shells are walked as apps below; examples are scanned inside the pages that frame them.
const patterns = workerFirstPatterns(
  await readFile(join(SITE_DIR, 'wrangler.jsonc'), 'utf8'),
);

const docsPaths = samplePages(
  (await htmlPaths()).filter(
    (path) =>
      !runsWorkerFirst(patterns, path) && !path.startsWith('/examples/'),
  ),
);

const audit: Audit = { axeVersion: '', scans: 0, findings: [] };

const browser = await chromium.launch();

let errors: unknown[];

try {
  const runs = await Promise.allSettled([
    auditDocs(browser, origin, docsPaths, 'light', audit),
    auditDocs(browser, origin, docsPaths, 'dark', audit),
    ...APPS.map((app) => auditApp(browser, origin, app, audit)),
  ]);

  errors = runs.flatMap((run): unknown[] =>
    run.status === 'rejected' ? [run.reason] : [],
  );
} finally {
  await browser.close();
}

const findings = audit.findings.sort(
  (a, b) =>
    a.page.localeCompare(b.page) ||
    a.scheme.localeCompare(b.scheme) ||
    a.rule.localeCompare(b.rule),
);

if (asJson) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  console.log(
    `axe-core ${audit.axeVersion}: ${audit.scans} scans over ${docsPaths.length} docs pages ` +
      `(light, dark) and ${APPS.length} sample-app mounts`,
  );

  const print = (finding: Finding) => {
    console.log(
      `\n${finding.page} [${finding.scheme}] ${finding.rule} (${finding.impact}): ${finding.help}`,
    );

    for (const target of finding.targets) console.log(`  ${target}`);
  };

  findings.forEach(print);
}

// A walk that could not reach its pages has not checked them.
for (const error of errors) console.error(error);

if (errors.length > 0) {
  fail(`${errors.length} audit run(s) failed before finishing`);
}

if (findings.length > 0) {
  fail(`${findings.length} axe violation(s)`);
}
