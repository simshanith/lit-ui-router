// The key a sleeping served view asks on before it warns, answered by a bootstrap still on its way to the walk that wakes it.
import type { Context } from 'lit-ui-router/context';

/** The identity of {@link bootPendingContext}. */
interface BootPendingContextKey {
  /** Names the key for a debugger; identity, not this string, is what matches. */
  readonly name: 'lit-ui-router-ssr/context#boot-pending';
}

/**
 * The boot-pending key: a pending `bootstrap()` answers with a function that
 * takes the view's check and runs it again once its walk has settled.
 *
 * @internal
 */
export type BootPendingContext = Context<
  BootPendingContextKey,
  (recheck: () => void) => void
>;

/**
 * Answered under a container while a `bootstrap()` over it has yet to settle
 * its walk, in development only.
 *
 * @internal
 */
// SAFETY: the brand is type-only; the frozen key object is the whole runtime value.
export const bootPendingContext: BootPendingContext = Object.freeze({
  name: 'lit-ui-router-ssr/context#boot-pending',
}) as BootPendingContext;
