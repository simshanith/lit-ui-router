import { SECURITY_HEADERS } from '../catalog/security-headers.ts';

/** The response with each security header it lacks; one it already sets, such as an asset's from `_headers`, is kept. */
export const withSecurityHeaders = (response: Response): Response => {
  const missing = Object.entries(SECURITY_HEADERS).filter(
    ([name]) => !response.headers.has(name),
  );

  if (missing.length === 0) return response;

  // A binding's response has immutable headers.
  const headers = new Headers(response.headers);

  for (const [name, value] of missing) headers.set(name, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
