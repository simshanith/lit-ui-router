// The Cloudflare v4 API client the CLIs here share. The token itself must
// never reach stdout/stderr — errors carry only the API's own status and messages.

const API_BASE = 'https://api.cloudflare.com/client/v4/accounts';

type CloudflareEnvelope = {
  success?: boolean;
  errors?: { code?: number; message?: string }[];
  result?: unknown;
};

/** One call under /accounts; resolves to the envelope's `result`, or throws. */
export async function cf(
  token: string,
  path: string,
  init?: { method: 'PATCH'; body: unknown },
): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      ...(init ? { 'content-type': 'application/json' } : {}),
    },
    body: init ? JSON.stringify(init.body) : undefined,
  });
  const envelope = (await response.json()) as CloudflareEnvelope;
  if (!response.ok || envelope.success === false) {
    const details = (envelope.errors ?? [])
      .map((error) => `${error.code ?? '?'}: ${error.message ?? '?'}`)
      .join('; ');
    throw new Error(
      `Cloudflare API ${init?.method ?? 'GET'} ${path} failed (HTTP ${response.status})${details ? ` — ${details}` : ''}`,
    );
  }
  return envelope.result;
}
