/**
 * @example Augments a module nothing imports
 * ```ts check
 * declare module 'fixture-seam' {
 *   interface Seam {
 *     params: { id: string };
 *   }
 * }
 * ```
 *
 * @example Augments a module no path resolves
 * ```ts check
 * declare module 'fixture-missing' {
 *   interface Seam {}
 * }
 * ```
 */
export const augment = true;
