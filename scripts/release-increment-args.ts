#!/usr/bin/env node
// Prints the release-it args for bump-version.yml's increment/other inputs,
// ONE ARG PER LINE. Newline-delimited is the least-clever safe transport for
// a multi-token argv: the core validates every arg to a whitespace-free
// allowlist, so lines and args are 1:1, and the workflow reads them with
// `mapfile -t` — no `read -a` word-splitting, no eval, no jq dependency.
// Zero args (increment=none without `other`) prints nothing.
//
// This file is the IO shell: all decisions live in the pure, unit-tested
// functions in ./release-increment-args.core.ts.

import { incrementArgs } from './release-increment-args.core.ts';

const [increment, other, ...extra] = process.argv.slice(2);
if (increment === undefined || extra.length > 0) {
  console.error(
    'usage: node scripts/release-increment-args.ts <increment> [other]',
  );
  process.exit(1);
}

try {
  const args = incrementArgs(increment, other ?? '');
  if (args.length > 0) console.log(args.join('\n'));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
