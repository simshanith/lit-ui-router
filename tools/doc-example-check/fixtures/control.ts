export class Control {
  /**
   * @example Opted in, indented, with one error
   * ```ts check
   * const n: number = 'not a number';
   * ```
   *
   * @example Unflagged: checked only under opt-out
   * ```ts
   * const unflagged: number = 'opt-out only';
   * ```
   *
   * @example Opted out
   * ```ts nocheck
   * const skipped: number = 'never reported';
   * ```
   *
   * @example Opted in and clean, with a vitepress title
   * ```typescript check [title.ts]
   * export const ok: string = 'fine';
   * ```
   */
  method(): void {}
}
