// Which requests the docs worker answers, and which dist file an asset request resolves to.

import { type ParseError, parse, printParseErrorCode } from 'jsonc-parser';
import * as v from 'valibot';

const WranglerConfig = v.object({
  assets: v.object({ run_worker_first: v.array(v.string()) }),
});

/** The `assets.run_worker_first` patterns from a wrangler.jsonc source. */
export function workerFirstPatterns(source: string): string[] {
  const errors: ParseError[] = [];
  const config: unknown = parse(source, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    throw new Error(
      `wrangler.jsonc: ${errors.map((e) => printParseErrorCode(e.error)).join(', ')}`,
    );
  }

  return v.parse(WranglerConfig, config).assets.run_worker_first;
}

/** Cloudflare's pattern semantics: `/x/*` matches below `/x/`, anything else matches exactly. */
export function runsWorkerFirst(
  patterns: readonly string[],
  pathname: string,
): boolean {
  return patterns.some((pattern) =>
    pattern.endsWith('/*')
      ? pathname.startsWith(pattern.slice(0, -1))
      : pathname === pattern,
  );
}

/**
 * dist-relative files an asset path may resolve to, in order, after the
 * binding's default `auto-trailing-slash` html_handling.
 */
export function assetCandidates(pathname: string): string[] {
  if (pathname.endsWith('/')) return [`${pathname}index.html`];

  return [pathname, `${pathname}.html`, `${pathname}/index.html`];
}
