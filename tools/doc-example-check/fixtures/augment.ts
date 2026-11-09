/**
 * @example Augments a module nothing imports
 * ```ts
 * declare module 'fixture-seam' {
 *   interface Seam {
 *     params: { id: string };
 *   }
 * }
 * ```
 *
 * @example Augments a module no path resolves
 * ```ts
 * declare module 'fixture-missing' {
 *   interface Seam {}
 * }
 * ```
 */
export const augment = true;
