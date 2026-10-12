// The Cloudflare v4 API client the CLIs here share. The token itself must
// never reach stdout/stderr, and errors redact the account id.

import type { Json } from '@tools/bootstrap/types.ts';

const API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

type CloudflareEnvelope = {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: Json;
};

/** One call under /accounts; resolves to the envelope's `result`, or throws. */
export async function cf(
  token: string,
  path: string,
  init?: { method: 'PATCH'; body: unknown },
): Promise<Json | undefined> {
  const headers = new Headers({ authorization: `Bearer ${token}` });

  if (init) headers.set('content-type', 'application/json');

  const response = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers,
    body: init ? JSON.stringify(init.body) : undefined,
  });

  // SAFETY: every Cloudflare v4 API response, error or not, is this envelope
  const envelope = (await response.json()) as CloudflareEnvelope;

  if (!response.ok || envelope.success === false) {
    const details = (envelope.errors ?? [])
      .map((error) => `${error.code ?? '?'}: ${error.message ?? '?'}`)
      .join('; ');

    // The account id leads the path; check-run summaries are public.
    const shown = path.replace(/^\/[^/]+/, '/{account_id}');

    throw new Error(
      `Cloudflare API ${init?.method ?? 'GET'} ${shown} failed (HTTP ${response.status})${details ? ` — ${details}` : ''}`,
    );
  }

  return envelope.result;
}
