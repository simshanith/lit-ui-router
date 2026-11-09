export class Control {
  /**
   * @example Indented, with one error
   * ```ts
   * const n: number = 'not a number';
   * ```
   *
   * @example A second error, in a typescript fence
   * ```typescript
   * const second: number = 'also reported';
   * ```
   *
   * @example Opted out
   * ```ts nocheck
   * const skipped: number = 'never reported';
   * ```
   *
   * @example Clean, with a vitepress title
   * ```ts [title.ts]
   * export const ok: string = 'fine';
   * ```
   */
  method(): void {}
}
