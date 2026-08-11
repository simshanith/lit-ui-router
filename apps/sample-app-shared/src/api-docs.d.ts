// @api-viewer/docs contributes `src` through a mixin, so it is absent from the
// shipped d.ts and invisible to web-component-analyzer.
/**
 * @element api-docs
 * @attr {string} src - URL of a custom-elements.json manifest.
 */
declare class ApiDocsElement extends HTMLElement {
  src: string;
}

declare global {
  interface HTMLElementTagNameMap {
    'api-docs': ApiDocsElement;
  }
}
