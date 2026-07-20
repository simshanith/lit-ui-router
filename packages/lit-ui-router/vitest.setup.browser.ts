// Browser-project default: no spec may leak a real click's native
// navigation — a popup at the tester URL is a duplicate tester.
import { suppressNativeClickNavigation } from './src/specs/browser-test-utils.js';

suppressNativeClickNavigation();
