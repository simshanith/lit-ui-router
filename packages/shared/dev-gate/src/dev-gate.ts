// The one `process` read a package ships: its #dev-gate import reaches this file under the `node` condition only.
declare const process: { readonly env: { readonly NODE_ENV?: string } };

/**
 * Whether development warnings fire under node: unless `NODE_ENV` is
 * `production`, read at each call so a test can set it.
 *
 * @internal
 */
export const devGate = (): boolean => process.env.NODE_ENV !== 'production';
