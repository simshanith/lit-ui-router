/**
 * Types `ui-router-effect`'s route snapshot from the registry: an app imports
 * it once, `import type {} from 'ui-router-registry/effect'`. It emits
 * nothing.
 *
 * @module
 */
// tsc reports TS2664 on the augmentation unless the module is imported here.
import type {} from 'ui-router-effect';

// The root, not ./registry.js: an app's `declare module 'ui-router-registry'` needs it loaded.
import type { RegisteredRouteTypes } from './index.js';

declare module 'ui-router-effect' {
  interface RouteTypes {
    snapshot: RegisteredRouteTypes['snapshot'];
  }
}
