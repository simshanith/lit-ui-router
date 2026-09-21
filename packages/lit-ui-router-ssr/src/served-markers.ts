// The one constant both halves of the seam read, in a module neither entry reaches through the other.

/**
 * Prefixes every part marker {@link UiViewRenderer} writes inside a
 * `<ui-view>`.
 *
 * `hydrate()` acts on comments whose data starts with `lit-part`, `/lit-part`
 * or `lit-node` and reads straight past every other comment, so a prefixed
 * marker is invisible to the walk hydrating the view's surroundings. The
 * client renames a view's own markers back at its wake, immediately before it
 * hydrates against them.
 *
 * @internal
 */
export const servedMarkerPrefix = 'ui-view:';
