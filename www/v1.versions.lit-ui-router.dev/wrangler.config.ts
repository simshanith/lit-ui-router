import { defineWranglerConfig } from 'wrangler/experimental-config';

// cloudflare.config.ts has no asset source; cf builds assets-only Workers with wrangler, which reads it here.
export default defineWranglerConfig({ assetsDirectory: './dist' });
