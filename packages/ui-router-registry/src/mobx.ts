/**
 * Types `ui-router-mobx`'s `RouterStore` from the registry: an app imports it
 * once, `import type {} from 'ui-router-registry/mobx'`. It emits nothing.
 *
 * @module
 */
// tsc reports TS2664 on the augmentation unless the module is imported here.
import type {} from 'ui-router-mobx';

// The entry point, so an app's `declare module 'ui-router-registry'` finds it loaded.
import type { RegisteredRouteTypes } from './index.js';

declare module 'ui-router-mobx' {
  interface RouteTypes {
    snapshot: RegisteredRouteTypes['snapshot'];
    snapshots: RegisteredRouteTypes['snapshots'];
  }
}
