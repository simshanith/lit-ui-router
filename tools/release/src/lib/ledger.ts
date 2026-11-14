// The release ledger's GET /ledger, read with the job's GitHub Actions OIDC token.
import {
  type LedgerSnapshot,
  LedgerSnapshotSchema,
} from '@tools/release-ledger';
import { Schema } from 'effect';
import * as v from 'valibot';

export const LEDGER_ORIGIN = 'https://release-ledger.lit-ui-router.dev';

const IdToken = v.object({ value: v.string() });

/** This job's OIDC id-token for the ledger's read audience. */
async function idToken(audience: string): Promise<string> {
  const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

  if (!url || !bearer) {
    throw new Error('no id-token request URL; the job needs id-token: write');
  }

  const request = new URL(url);
  request.searchParams.set('audience', audience);

  const response = await fetch(request, {
    headers: { Authorization: `Bearer ${bearer}` },
  });

  if (!response.ok)
    throw new Error(`id-token request: HTTP ${response.status}`);

  return v.parse(IdToken, await response.json()).value;
}

/** Every `versions` and `dist_tags` row the ledger holds. */
export async function readLedger(
  origin: string = LEDGER_ORIGIN,
): Promise<LedgerSnapshot> {
  const token = await idToken(`${origin}/ledger`);
  console.log(`::add-mask::${token}`);

  const response = await fetch(`${origin}/ledger`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `GET /ledger: HTTP ${response.status} ${await response.text()}`,
    );
  }

  return Schema.decodeUnknownSync(LedgerSnapshotSchema)(await response.json());
}
