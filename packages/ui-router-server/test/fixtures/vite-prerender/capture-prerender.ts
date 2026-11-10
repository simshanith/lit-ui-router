// Imported with --import, so it runs in every thread with node's own resolution.
import { prerender } from 'ui-router-server/prerender';

Object.assign(globalThis, { processPrerender: prerender });
