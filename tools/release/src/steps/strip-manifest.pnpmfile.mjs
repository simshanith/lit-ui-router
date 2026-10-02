// pnpmfile loaded only for packPublishTarball's `pnpm pack` (via
// PNPM_CONFIG_PNPMFILE, so installs and the lockfile never see it). The hook
// edits the packed manifest in memory; the package.json on disk is untouched.

import { strippedManifest } from './release-pack.core.ts';

export const hooks = {
  beforePacking: strippedManifest,
};
