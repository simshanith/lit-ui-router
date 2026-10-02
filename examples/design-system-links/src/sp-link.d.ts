// Spectrum's Link takes `href` from a mixin, so the shipped d.ts hides it from
// web-component-analyzer and `href=${srefHref(...)}` reads as an unknown
// attribute. Augmenting the class declares it; `@element`-style shims like
// examples/hellogalaxy/src/model-viewer.d.ts cannot, because the upstream
// HTMLElementTagNameMap entry already owns the tag.
import '@spectrum-web-components/link/src/Link.js';

declare module '@spectrum-web-components/link/src/Link.js' {
  /**
   * @element sp-link
   * @attr {string} href
   */
  interface Link {
    href?: string;
  }
}
