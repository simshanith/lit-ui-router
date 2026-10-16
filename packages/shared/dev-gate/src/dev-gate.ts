/**
 * Whether development warnings fire off node: always, since only a node
 * runtime can say it is production.
 *
 * @internal
 */
export const devGate = (): boolean => true;
