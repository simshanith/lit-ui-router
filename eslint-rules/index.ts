// The local `repo/` eslint plugin: one module per rule (see eslint.config.ts).
// Rules about lit-ui-router itself graduate to packages/eslint-plugin-lit-ui-router;
// what stays here is repo convention only.
import { requireBuildTypes } from './require-build-types.ts';

export default {
  rules: {
    'require-build-types': requireBuildTypes,
  },
};
