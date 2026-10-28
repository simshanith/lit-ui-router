// A release-ledger worker whose LedgerReader serves the fixture rows, for workerd tests and local dev.
import { WorkerEntrypoint } from 'cloudflare:workers';

import { fixtureLedger } from './rows.ts';

export class LedgerReader extends WorkerEntrypoint {
  packages() {
    return fixtureLedger.packages();
  }

  tagged(name: string, tag: string) {
    return fixtureLedger.tagged(name, tag);
  }

  versions(name: string) {
    return fixtureLedger.versions(name);
  }
}

export default {
  fetch: () => new Response(null, { status: 404 }),
};
