// The `lit-ui-router/` eslint plugin (#659): rules that understand
// lit-ui-router directives. Private for now — the ship decision comes after
// the rules prove themselves in this repo's own lanes.
import { anchorIsValid } from './anchor-is-valid.ts';

export default {
  rules: {
    'anchor-is-valid': anchorIsValid,
  },
};
