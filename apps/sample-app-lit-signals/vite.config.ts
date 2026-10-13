import { sampleAppViteConfig } from 'sample-app-shared/tooling/vite.config.shared.js';

export default sampleAppViteConfig({
  configUrl: import.meta.url,
  serverPort: 5176,
  previewPort: 4176,
});
