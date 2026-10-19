/** A thrown value's message: `Error#message`, else its string form. */
export function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
