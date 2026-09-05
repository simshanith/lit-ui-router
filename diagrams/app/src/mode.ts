/**
 * ARTIFACT MODE — the one build flag, read in one place.
 *
 * `vite build --mode artifact` (npm run build:artifact, then artifact.ts)
 * bakes the whole atlas into a single html file for a claude.ai Artifact:
 * the router runs on the hash, the manifest and every fragment come from a
 * JSON island instead of a fetch, analytics is off, and the links out to the
 * flat set are pinned to the live site. The site build sees `false` here and
 * behaves exactly as it always has.
 */
// Optional: prerender.ts imports src/views.ts under plain node, where vite's
// `import.meta.env` does not exist.
export const ARTIFACT = import.meta.env?.MODE === 'artifact';
