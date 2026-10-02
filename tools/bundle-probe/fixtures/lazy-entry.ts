// Honours a `free: ['rolldown']` claim: the external is behind a dynamic
// import, so it lands in a chunk of its own and off the static graph.
export const load = async (): Promise<string> =>
  (await import('./uses-external.ts')).bundlerKind;
