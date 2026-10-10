/** An entry point's rejection: print it whole, stack included, and fail the task. */
export function failMain(cause: unknown): void {
  console.error(cause);
  process.exitCode = 1;
}
