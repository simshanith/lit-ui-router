// @api-viewer/docs contributes `src` through a mixin, so it is absent from the
// shipped d.ts and invisible to web-component-analyzer. `@element` is what
// registers the tag: adding it to HTMLElementTagNameMap instead would collide
// with any upstream entry (TS2717) and, in a non-module .d.ts, `declare global`
// is itself invalid (TS2669) — both masked by skipLibCheck.
/**
 * @element api-docs
 * @attr {string} src - URL of a custom-elements.json manifest.
 */
declare class ApiDocsElement extends HTMLElement {}
