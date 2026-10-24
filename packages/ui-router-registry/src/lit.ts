/**
 * Types `lit-ui-router`'s sref directives from the registry: an app imports
 * it once, `import type {} from 'ui-router-registry/lit'`. It emits nothing.
 *
 * @module
 */
// tsc reports TS2664 on the augmentation unless the module is imported here.
import type {} from 'lit-ui-router';

import type { RegisteredRouteTypes } from './registry.js';

declare module 'lit-ui-router' {
  // oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- merges the registry into lit-ui-router's interface
  interface RouteTypes extends RegisteredRouteTypes {}
}
