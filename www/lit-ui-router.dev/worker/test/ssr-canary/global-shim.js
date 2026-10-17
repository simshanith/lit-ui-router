// The shim lit-ui-router-ssr documents for a Node prerender; it imports node:fs and node-fetch.
import '@lit-labs/ssr/lib/install-global-dom-shim.js';

import { handler } from './render.js';

export default handler;
