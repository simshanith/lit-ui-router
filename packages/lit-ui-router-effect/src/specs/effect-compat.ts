import { Cause, Context, Exit } from 'effect';

/**
 * Spec-only shims over the effect 3/4 renames, so the specs run against both
 * majors (see `test:effect3-compat`). Typed against the catalog's effect 4;
 * the 3.x branch is exercised at runtime only.
 */

/** `Context.Service` in effect 4, `Context.GenericTag` in effect 3. */
export function serviceKey<Shape>(key: string): Context.Service<Shape, Shape> {
  const v3 = Context as unknown as {
    readonly GenericTag?: (key: string) => Context.Service<Shape, Shape>;
  };
  return v3.GenericTag ? v3.GenericTag(key) : Context.Service<Shape>(key);
}

/** `Exit.hasInterrupts`-only in effect 4, `Exit.isInterrupted` in effect 3. */
export function isInterrupted(exit: Exit.Exit<unknown, unknown>): boolean {
  if (!Exit.isFailure(exit)) return false;
  const v3 = Cause as unknown as {
    readonly isInterruptedOnly?: (cause: unknown) => boolean;
  };
  return v3.isInterruptedOnly
    ? v3.isInterruptedOnly(exit.cause)
    : Cause.hasInterruptsOnly(exit.cause);
}
