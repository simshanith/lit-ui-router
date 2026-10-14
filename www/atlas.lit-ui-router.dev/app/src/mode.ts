/**
 * ARTIFACT MODE — the one build flag, read in one place.
 *
 * `vite build --mode artifact` (npm run build:artifact, then artifact.ts)
 * bakes the condensed atlas into a single html file for a claude.ai Artifact:
 * the gallery and the colophon run on the hash, every other page is a link
 * out to the live site, the manifest and the card pictures come from a JSON
 * island instead of a fetch, and analytics is off. The site build sees
 * `false` here and behaves exactly as it always has.
 */
// Optional: prerender.ts imports src/views.ts under plain node, where vite's
// `import.meta.env` does not exist.
export const ARTIFACT = import.meta.env?.MODE === 'artifact';
