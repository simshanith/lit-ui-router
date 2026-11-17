/** Each snapshot's path segment, and what its 503 calls it. */
const SNAPSHOTS = {
  v1: 'The 1.x docs',
  main: 'The unreleased docs',
} as const;

export type SnapshotId = keyof typeof SNAPSHOTS;

const isSnapshotId = (segment: string): segment is SnapshotId =>
  Object.hasOwn(SNAPSHOTS, segment);

/** The snapshot whose prefix, bare or with a subpath, the path is under. */
export function snapshotOf(pathname: string): SnapshotId | undefined {
  const segment = pathname.split('/')[1] ?? '';

  return isSnapshotId(segment) ? segment : undefined;
}

/** A snapshot Worker's service binding, as far as the hand-off reads it. */
export type SnapshotBinding = {
  fetch: (request: Request) => Promise<Response>;
};

const unavailable = (id: SnapshotId): Response =>
  new Response(`${SNAPSHOTS[id]} are unavailable right now.\n`, {
    status: 503,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

/** Hands the request, unchanged, to the snapshot's Worker; a missing binding or a failing Worker is a plain 503, never a main-site page. */
export async function serveSnapshot(
  request: Request,
  id: SnapshotId,
  snapshot: SnapshotBinding | undefined,
): Promise<Response> {
  if (snapshot === undefined) return unavailable(id);

  try {
    const response = await snapshot.fetch(request);

    return response.status >= 500 ? unavailable(id) : response;
  } catch {
    return unavailable(id);
  }
}
