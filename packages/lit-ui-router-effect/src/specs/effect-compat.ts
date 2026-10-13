import { Cause, Context, Exit } from 'effect';

/**
 * Spec-only shims over the effect 3/4 renames, so the specs run against both
 * majors (see `test:effect3-compat`). Typed against the catalog's effect 4;
 * the 3.x branch is exercised at runtime only.
 */

/** `Context.GenericTag` as effect 3 exports it. */
interface Effect3Context {
  readonly GenericTag?: <Api>(key: string) => Context.Service<Api, Api>;
}

/** `Cause.isInterruptedOnly` as effect 3 exports it. */
interface Effect3Cause {
  readonly isInterruptedOnly?: (cause: Cause.Cause<unknown>) => boolean;
}

/** `Context.Service` in effect 4, `Context.GenericTag` in effect 3. */
export function serviceKey<Api>(key: string): Context.Service<Api, Api> {
  // SAFETY: effect 3 exports `GenericTag`; on effect 4 the member is absent.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- each major's types omit the other's member, so no single assertion reaches it
  const v3 = Context as unknown as Effect3Context;

  return v3.GenericTag ? v3.GenericTag<Api>(key) : Context.Service<Api>(key);
}

/** `Exit.hasInterrupts`-only in effect 4, `Exit.isInterrupted` in effect 3. */
export function isInterrupted(exit: Exit.Exit<unknown, unknown>): boolean {
  if (!Exit.isFailure(exit)) return false;

  // SAFETY: effect 3 exports `isInterruptedOnly`; on effect 4 the member is absent.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions -- each major's types omit the other's member, so no single assertion reaches it
  const v3 = Cause as unknown as Effect3Cause;

  return v3.isInterruptedOnly
    ? v3.isInterruptedOnly(exit.cause)
    : Cause.hasInterruptsOnly(exit.cause);
}
