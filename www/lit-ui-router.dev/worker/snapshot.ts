/** The frozen 1.x docs' prefix, bare and with its subpaths. */
export const isSnapshotPath = (pathname: string): boolean =>
  pathname === '/v1' || pathname.startsWith('/v1/');

const unavailable = (): Response =>
  new Response('The 1.x docs are unavailable right now.\n', {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

/** Hands the request, unchanged, to the snapshot's Worker; a missing binding or a failing Worker is a plain 503, never a main-site page. */
export async function serveSnapshot(
  request: Request,
  snapshot: { fetch: (request: Request) => Promise<Response> } | undefined,
): Promise<Response> {
  if (snapshot === undefined) return unavailable();

  try {
    const response = await snapshot.fetch(request);

    return response.status >= 500 ? unavailable() : response;
  } catch {
    return unavailable();
  }
}
