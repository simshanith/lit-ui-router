// `rolldown` is a devDependency of this package, so it resolves and can be
// named external the way a probed package's declared deps are.
import { rolldown } from 'rolldown';

export const bundlerKind = typeof rolldown;
