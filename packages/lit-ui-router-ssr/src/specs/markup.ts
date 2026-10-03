// String surgery on drawn pages, free of element registrations so both lanes can import it.
import { signatureAttribute } from '../signature.js';

/** The signature block a page opens on, with its JSON captured. */
const leadingSignature = new RegExp(
  `^<script type="application/json" ${signatureAttribute}>(.*?)</script>`,
  's',
);

/** A page with its leading signature block dropped. */
export const withoutSignature = (page: string): string =>
  page.replace(leadingSignature, '');

/** The JSON text of the signature block a page opens on. */
export const signatureText = (page: string): string =>
  leadingSignature.exec(page)![1];

/** A page with every html comment dropped, as a comment-stripping minifier leaves it. */
export const stripComments = (page: string): string =>
  page.replaceAll(/<!--[\s\S]*?-->/g, '');
