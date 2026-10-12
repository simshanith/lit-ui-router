// Which requests the docs worker answers before the assets binding.

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
