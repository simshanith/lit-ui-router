// The local `repo/` eslint plugin: one module per rule (see eslint.config.ts).
import { anchorIsValid } from './anchor-is-valid.ts';
import { requireBuildTypes } from './require-build-types.ts';

export default {
  rules: {
    'anchor-is-valid': anchorIsValid,
    'require-build-types': requireBuildTypes,
  },
};
