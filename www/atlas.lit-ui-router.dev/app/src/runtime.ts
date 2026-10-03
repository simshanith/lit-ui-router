// The page's one Effect runtime; it lives as long as the page, so nothing disposes it.
import { Context, Effect, Layer, ManagedRuntime } from 'effect';
import type { Manifest } from './manifest.ts';
import { requestFragment, requestManifest } from './manifest.ts';

/** Either kind of row carries the two fields a fragment read needs. */
export interface FragmentRow {
  id: string;
  file: string;
}

/** The index, read once per runtime, and any plate's fragment. */
export class DrawingSet extends Context.Tag('atlas/DrawingSet')<
  DrawingSet,
  {
    readonly manifest: Effect.Effect<Manifest, Error>;
    readonly fragment: (row: FragmentRow) => Effect.Effect<string, Error>;
  }
>() {}

const asError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

// Building the layer builds the manifest's cache: every `manifest` resolve shares one read.
export const DrawingSetLive = Layer.effect(
  DrawingSet,
  Effect.map(
    Effect.cached(Effect.tryPromise({ try: requestManifest, catch: asError })),
    (manifest) => ({
      manifest,
      fragment: (row: FragmentRow) =>
        Effect.tryPromise({ try: () => requestFragment(row), catch: asError }),
    }),
  ),
);

export const runtime = ManagedRuntime.make(DrawingSetLive);

/** The index, from the runtime's one read. */
export const loadManifest = (): Promise<Manifest> =>
  runtime.runPromise(Effect.flatMap(DrawingSet, (set) => set.manifest));

/** A plate's fragment: the baked island in the artifact, a fetch on the site. */
export const loadFragment = (row: FragmentRow): Promise<string> =>
  runtime.runPromise(Effect.flatMap(DrawingSet, (set) => set.fragment(row)));
