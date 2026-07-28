import { sampleAppViteConfig } from 'sample-app-shared/tooling/vite.config.shared.js';

export default sampleAppViteConfig({
  configUrl: import.meta.url,
  serverPort: 5173,
  previewPort: 4173,
});
