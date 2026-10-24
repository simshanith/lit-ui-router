import type { RouteSnapshot } from '@repo/route-snapshot';

/**
 * Typed route snapshots, filled in by module augmentation. Empty, the
 * snapshot is {@link RouteSnapshot}, as it always has been; nothing here
 * emits JavaScript.
 *
 * An app or a registry such as `ui-router-registry` fills it in. Its member:
 *
 * - `snapshot`: the type `routeRef`'s ref holds, a typed view of
 *   {@link RouteSnapshot} whose `includes(name)` narrows `current` and
 *   `params`.
 *
 * ```ts
 * declare module 'ui-router-effect' {
 *   interface RouteTypes {
 *     snapshot: AppRouteSnapshot;
 *   }
 * }
 * ```
 *
 * @category types
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type -- filled in by module augmentation
export interface RouteTypes {}

/**
 * The route snapshot as {@link RouteTypes} types it: its `snapshot` member,
 * or {@link RouteSnapshot} until it is filled in.
 *
 * @category types
 */
export type TypedRouteSnapshot = RouteTypes extends {
  /** The filled-in snapshot type. */
  snapshot: infer S;
}
  ? S
  : RouteSnapshot;
