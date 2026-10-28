// Plans CI's e2e matrix: the default suites in groups of SUITES_PER_JOB,
// exported as `groups` (a JSON array of arrays) to GITHUB_OUTPUT, printed when
// that is unset. Node builtins and suites.ts only, so the plan job needs no
// install.
//
// env: SUITES_PER_JOB (positive integer), GITHUB_OUTPUT (runner file).

import { appendFileSync } from 'node:fs';

import { defaultSuites, groupSuites } from './suites.ts';

const main = (): void => {
  const raw = process.env.SUITES_PER_JOB ?? '';
  const perJob = Number(raw);

  if (raw.trim() === '' || !Number.isInteger(perJob) || perJob < 1) {
    console.error(
      `e2e-plan: SUITES_PER_JOB must be a positive integer, got ${JSON.stringify(raw)}`,
    );
    process.exitCode = 1;

    return;
  }

  const line = `groups=${JSON.stringify(groupSuites(defaultSuites, perJob))}`;

  console.log(line);

  const output = process.env.GITHUB_OUTPUT;

  if (output) appendFileSync(output, `${line}\n`);
};

if (import.meta.main) main();
