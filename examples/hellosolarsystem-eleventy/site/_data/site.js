// Eleventy calls this once per build: one prerender() over the router's paths, linked under the site's base.
import { renderSite } from '../../node_modules/.build/server/prerender.js';

import base from './base.js';

export default () => renderSite(base);
