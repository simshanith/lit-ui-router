// publish-npm.yml posts a release-ledger claim as publish_npm's last step. The
// claim must never decide the publish's result, and its id-token must pass the
// worker's OIDC pins, which live in the ledger's wrangler.jsonc.
import assert from 'node:assert/strict';
import { accessSync, constants, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse as parseJsonc } from 'jsonc-parser';
import { parse } from 'yaml';

import { workspaceRoot } from '@tools/bootstrap/root.ts';

const load = (file: string): string =>
  readFileSync(join(workspaceRoot, file), 'utf8');

const WORKFLOW = '.github/workflows/publish-npm.yml';

const TASK = '.config/mise/tasks/ledger_claim';

/** As much of a step as this check reads. */
type Step = {
  id?: string;
  run?: string;
  if?: string;
  'continue-on-error'?: boolean;
  'timeout-minutes'?: number;
  env?: Record<string, string>;
};

/** As much of a job as this check reads. */
type Job = {
  steps?: Step[];
  environment?: string;
  permissions?: Record<string, string>;
};

/** As much of the ledger's wrangler.jsonc as this check reads. */
type Wrangler = {
  vars: { OIDC_ENVIRONMENT: string; OIDC_WORKFLOWS: string[] };
};

// SAFETY: actionlint holds workflows to the Actions schema, which Job subsets
const jobs = (parse(load(WORKFLOW)) as { jobs: Record<string, Job> }).jobs;

const publish = jobs.publish_npm;

const steps = publish?.steps ?? [];

const claimIndex = steps.findIndex(
  ({ run }) => run?.trim() === 'mise run ledger_claim',
);

const claim = steps[claimIndex];

// SAFETY: wrangler rejects a config whose vars lack these at deploy
const { vars } = parseJsonc(
  load('www/release-ledger.lit-ui-router.dev/wrangler.jsonc'),
) as Wrangler;

describe('publish-npm ledger claim', () => {
  it('is a publish_npm step after Publish that follows its dry run', () => {
    assert.ok(claim, 'publish_npm has no `mise run ledger_claim` step');
    assert.ok(
      claimIndex > steps.findIndex(({ id }) => id === 'publish'),
      'the claim step must follow the publish step',
    );
    assert.equal(claim.if, undefined);
    assert.equal(claim.env?.DRY_RUN, '${{ inputs.dryRun }}');
  });

  it('has no job of its own, so a publish records one deployment', () => {
    assert.equal(jobs.ledger_claim, undefined);
  });

  it('runs an executable mise task', () => {
    accessSync(join(workspaceRoot, TASK), constants.X_OK);
  });

  it('cannot fail or hold the publish job', () => {
    assert.equal(claim?.['continue-on-error'], true);
    assert.ok(claim?.['timeout-minutes'], 'the claim step has no timeout');
  });

  it('mints a token the ledger accepts', () => {
    assert.equal(publish?.permissions?.['id-token'], 'write');
    assert.equal(publish?.environment, vars.OIDC_ENVIRONMENT);
    assert.ok(
      vars.OIDC_WORKFLOWS.includes(`simshanith/lit-ui-router/${WORKFLOW}`),
      `OIDC_WORKFLOWS lacks ${WORKFLOW}`,
    );
  });
});
