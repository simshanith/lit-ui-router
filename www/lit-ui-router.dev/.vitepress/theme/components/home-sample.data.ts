// Build-time data for HomeAnnotatedCode.vue: the sample's listing, highlighted by the site's renderer with its regions marked.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  createMarkdownRenderer,
  defineLoader,
  type SiteConfig,
} from 'vitepress';

import { HOME_SAMPLE_NAME } from '../../../catalog/home-sample.ts';
import { highlightAnnotated, listingOf } from '../../annotated-code.ts';

const SOURCE = fileURLToPath(
  new URL('../../../catalog/home-sample/app.ts', import.meta.url),
);

export interface HomeSample {
  /** The highlighted `<pre>`, each region part a `<mark>`. */
  html: string;
  /** How many lines the listing has. */
  lines: number;
}

declare const data: HomeSample;

export { data };

export default defineLoader({
  watch: [SOURCE],
  async load(): Promise<HomeSample> {
    // SAFETY: VitePress sets the resolved config on the global before it loads any page data
    const config = (globalThis as { VITEPRESS_CONFIG?: SiteConfig })
      .VITEPRESS_CONFIG!;

    const md = await createMarkdownRenderer(
      config.srcDir,
      config.markdown,
      config.site.base,
      config.logger,
    );

    const listing = listingOf(await readFile(SOURCE, 'utf8'));

    return {
      html: await highlightAnnotated(md, listing, 'ts', HOME_SAMPLE_NAME),
      lines: listing.split('\n').length,
    };
  },
});
