#!/usr/bin/env node
// Read-only check that the Altitude Atlas Pages project serves the www/atlas
// branch head. The caller resolves the head and passes it, so the verdict and
// the check run it feeds name the same commit.
//
// Usage:
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node pages-deploy.ts <www/atlas head sha>
//
// Exit codes: 0 in sync, 1 a deploy is owed, 2 usage/API error. The token
// needs "Pages: Read". All decisions live in pages-deploy.core.ts.

import { cf } from './cloudflare-api.ts';
import {
  PAGES_PROJECT,
  PRODUCTION_BRANCH,
  deployVerdict,
  deploymentsFromApi,
  isCommitSha,
} from './pages-deploy.core.ts';

// Annotated, not just inferred: never-returning calls only narrow past an
// explicitly typed declaration, which is what lets `branchHead` narrow below.
const usage: () => never = () => {
  console.error(`usage: pages-deploy.ts <${PRODUCTION_BRANCH} head sha>`);
  process.exit(2);
};

const main = async ([branchHead, ...extra]: string[]): Promise<void> => {
  if (extra.length > 0 || branchHead === undefined || !isCommitSha(branchHead))
    usage();

  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) {
    console.error(
      'Missing required env: set CLOUDFLARE_API_TOKEN (token with ' +
        '"Pages: Read") and CLOUDFLARE_ACCOUNT_ID.',
    );
    process.exitCode = 2;
    return;
  }

  try {
    const result = await cf(
      token,
      `/${accountId}/pages/projects/${PAGES_PROJECT}/deployments?env=production`,
    );
    const report = deployVerdict(deploymentsFromApi(result), branchHead);
    console.log(report.text);
    process.exitCode = report.ok ? 0 : 1;
  } catch (error: unknown) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 2;
  }
};

if (import.meta.main) await main(process.argv.slice(2));
