// publish-npm.yml posts a release-ledger claim after publishing. The claim
// must never decide the publish's result, and its id-token must pass the
// worker's OIDC pins, which live in the ledger's wrangler.jsonc.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse as parseJsonc } from 'jsonc-parser';
import { parse } from 'yaml';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

const load = (file: string): string =>
  readFileSync(join(workspaceRoot, file), 'utf8');

const WORKFLOW = '.github/workflows/publish-npm.yml';

/** As much of a job as this check reads. */
type Job = {
  needs?: string | string[];
  if?: string;
  'continue-on-error'?: boolean;
  environment?: string;
  permissions?: Record<string, string>;
};

/** As much of the ledger's wrangler.jsonc as this check reads. */
type Wrangler = {
  vars: { OIDC_ENVIRONMENT: string; OIDC_WORKFLOWS: string[] };
};

// SAFETY: actionlint holds workflows to the Actions schema, which Job subsets
const jobs = (parse(load(WORKFLOW)) as { jobs: Record<string, Job> }).jobs;

const claim = jobs.ledger_claim;

// SAFETY: wrangler rejects a config whose vars lack these at deploy
const { vars } = parseJsonc(
  load('www/release-ledger.lit-ui-router.dev/wrangler.jsonc'),
) as Wrangler;

describe('publish-npm ledger claim', () => {
  it('runs after publish_npm and skips dry runs', () => {
    assert.ok(claim, 'publish-npm.yml has no ledger_claim job');
    assert.deepEqual([claim.needs].flat(), ['publish_npm']);
    assert.match(claim.if ?? '', /!inputs\.dryRun/);
  });

  it('cannot fail the run, and nothing waits on it', () => {
    assert.equal(claim?.['continue-on-error'], true);

    const dependents = Object.entries(jobs)
      .filter(([, job]) => [job.needs ?? []].flat().includes('ledger_claim'))
      .map(([name]) => name);

    assert.deepEqual(dependents, []);
  });

  it('mints a token the ledger accepts', () => {
    assert.equal(claim?.permissions?.['id-token'], 'write');
    assert.equal(claim?.environment, vars.OIDC_ENVIRONMENT);
    assert.ok(
      vars.OIDC_WORKFLOWS.includes(`simshanith/lit-ui-router/${WORKFLOW}`),
      `OIDC_WORKFLOWS lacks ${WORKFLOW}`,
    );
  });
});
