import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

export default defineConfig({
  // TODO: Enable this when the app typechecks properly
  plugins: [checker({ typescript: false })],
});
