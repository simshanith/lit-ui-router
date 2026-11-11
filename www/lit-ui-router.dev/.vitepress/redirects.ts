import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RedirectLine } from 'ui-router-server/prerender';
import type { Plugin } from 'vite';

import { REDIRECTS } from '../catalog/redirects.ts';

// https://developers.cloudflare.com/workers/static-assets/redirects/
export const LIMITS = { static: 2000, dynamic: 100, lineLength: 1000 } as const;

/** The frozen 1.x snapshot's prefix: no redirect may claim a path under it. */
export const SNAPSHOT_PREFIX = '/v1/';

const PLACEHOLDER = /:([A-Za-z]\w*)/g;

/** A rule with a splat or a named placeholder; Cloudflare counts and orders these apart from static rules. */
export const isDynamic = ({ from }: RedirectLine): boolean =>
  from.includes('*') || /:[A-Za-z]/.test(from);

/** A static page source and the spellings html_handling redirected to it, each sent straight to the rule's target. */
export function spellings(rule: RedirectLine): RedirectLine[] {
  if (isDynamic(rule) || rule.from === '/' || /\.\w+$/.test(rule.from))
    return [rule];

  const page = rule.from.replace(/\/$/, '');

  const froms = rule.from.endsWith('/')
    ? [rule.from, page, `${rule.from}index.html`]
    : [rule.from, `${page}/`, `${page}.html`];

  return froms.map((from) => ({ ...rule, from }));
}

/** The table's `_redirects` lines, every row with its spellings. */
export const redirectLines = (rules: readonly RedirectLine[]): RedirectLine[] =>
  rules.flatMap(spellings);

/** One `_redirects` line. */
export const redirectsLine = ({ from, to, status }: RedirectLine): string =>
  `${from} ${to} ${status}`;

/** The `_redirects` file body, one line per rule, in table order. */
export const redirectsFileBody = (rules: readonly RedirectLine[]): string =>
  rules.map((rule) => `${redirectsLine(rule)}\n`).join('');

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Matches a request path against a rule's source: `*` is the splat, `:name` one path segment. */
const sourcePattern = (from: string): RegExp =>
  new RegExp(
    `^${from
      .split('*')
      .map((part) => escapeRegExp(part).replace(PLACEHOLDER, '(?<$1>[^/]+)'))
      .join('(?<splat>.*)')}$`,
  );

/** The first rule matching the path, with its target's placeholders filled; `null` when none does. */
export function matchRedirect(
  rules: readonly RedirectLine[],
  path: string,
): { location: string; status: number } | null {
  for (const rule of rules) {
    const match = sourcePattern(rule.from).exec(path);

    if (!match) continue;

    return {
      location: rule.to.replace(
        PLACEHOLDER,
        (placeholder, name: string) => match.groups?.[name] ?? placeholder,
      ),
      status: rule.status,
    };
  }

  return null;
}

/** Problems with the table on its own: Cloudflare's limits and ordering, and the site's anchoring, snapshot and chain rules. */
export function tableProblems(rules: readonly RedirectLine[]): string[] {
  const dynamic = rules.filter(isDynamic).length;
  const firstDynamic = rules.findIndex(isDynamic);

  const tableChecks: [boolean, string][] = [
    [
      rules.length - dynamic > LIMITS.static,
      `over ${LIMITS.static} static rules`,
    ],
    [dynamic > LIMITS.dynamic, `over ${LIMITS.dynamic} dynamic rules`],
    [
      new Set(rules.map(({ from }) => from)).size !== rules.length,
      'duplicate sources',
    ],
  ];

  const ruleChecks = rules.flatMap((rule, index) => {
    const line = redirectsLine(rule);

    const checks: [boolean, string][] = [
      [
        firstDynamic !== -1 && index > firstDynamic && !isDynamic(rule),
        'static rule after a dynamic one',
      ],
      [line.length > LIMITS.lineLength, `over ${LIMITS.lineLength} characters`],
      [
        !rule.from.startsWith('/') || !rule.to.startsWith('/'),
        'not root-anchored',
      ],
      [
        rule.from.startsWith(SNAPSHOT_PREFIX),
        `source under ${SNAPSHOT_PREFIX}`,
      ],
      [
        matchRedirect(rules, rule.to.split(/[?#]/)[0]) !== null,
        'target is redirected again',
      ],
    ];

    return checks.map(([failed, problem]): [boolean, string] => [
      failed,
      `${line}: ${problem}`,
    ]);
  });

  return [...tableChecks, ...ruleChecks].flatMap(([failed, problem]) =>
    failed ? [problem] : [],
  );
}

/** A path inside the source, standing in for its splat and placeholders. */
const sampleSource = (from: string): string =>
  from.replace(/\*/g, 'x').replace(PLACEHOLDER, 'x');

const workerFirstPattern = (pattern: string): RegExp =>
  new RegExp(`^${pattern.split('*').map(escapeRegExp).join('.*')}$`);

/** Rules whose source `run_worker_first` (`true` read as `['/*']`) sends to the worker, where Cloudflare never applies `_redirects`. */
export function workerFirstProblems(
  rules: readonly RedirectLine[],
  runWorkerFirst: readonly string[],
): string[] {
  const included = runWorkerFirst.filter((pattern) => !pattern.startsWith('!'));

  const excluded = runWorkerFirst.flatMap((pattern) =>
    pattern.startsWith('!') ? [pattern.slice(1)] : [],
  );

  const matches = (list: readonly string[], path: string) =>
    list.some((pattern) => workerFirstPattern(pattern).test(path));

  return rules.flatMap((rule) => {
    const path = sampleSource(rule.from);
    const shadowed = matches(included, path) && !matches(excluded, path);

    return shadowed ? [`${redirectsLine(rule)}: run_worker_first`] : [];
  });
}

/** The files a path could be served from, as Cloudflare's html_handling resolves it. */
const servedFiles = (outDir: string, path: string): string[] => {
  const file = join(outDir, decodeURIComponent(path));

  return path.endsWith('/')
    ? [join(file, 'index.html')]
    : [file, `${file}.html`, join(file, 'index.html')];
};

/** Static rules whose target is no built file, or whose source still is one. */
export function builtProblems(
  rules: readonly RedirectLine[],
  outDir: string,
): string[] {
  const served = (path: string) =>
    servedFiles(outDir, path).some((file) => existsSync(file));

  return rules
    .filter((rule) => !isDynamic(rule))
    .flatMap((rule) => [
      ...(served(rule.to.split(/[?#]/)[0])
        ? []
        : [`${redirectsLine(rule)}: no built file at the target`]),
      ...(served(rule.from)
        ? [`${redirectsLine(rule)}: a built file still answers the source`]
        : []),
    ]);
}

/** The build's `buildEnd`: fails on a dead target or a live source, then writes `_redirects`. */
export async function writeRedirects(outDir: string): Promise<void> {
  const lines = redirectLines(REDIRECTS);
  const problems = [...tableProblems(lines), ...builtProblems(lines, outDir)];

  if (problems.length > 0)
    throw new Error(`catalog/redirects.ts:\n  ${problems.join('\n  ')}`);

  await writeFile(join(outDir, '_redirects'), redirectsFileBody(lines));
}

/** Dev parity with dist/_redirects: answers the same table with the same status. */
export function redirectsPlugin(): Plugin {
  const lines = redirectLines(REDIRECTS);

  return {
    name: 'redirects',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const [path = '/', query] = (req.url ?? '/').split(/\?(.*)/s);
        const redirect = matchRedirect(lines, path);

        if (!redirect) return next();

        const search =
          query === undefined || redirect.location.includes('?')
            ? ''
            : `?${query}`;

        res.writeHead(redirect.status, {
          Location: `${redirect.location}${search}`,
        });
        res.end();
      });
    },
  };
}
