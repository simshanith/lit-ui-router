import { exampleIndexData } from '../../example-index.ts';
import { packageIndexData } from '../../package-index.ts';
import type { FacetIndexData } from './faceted-index.ts';

export interface FacetedIndexBundle {
  examples: FacetIndexData;
  packages: FacetIndexData;
}

export declare const data: FacetedIndexBundle;

export default {
  load(): FacetedIndexBundle {
    return {
      examples: exampleIndexData(),
      packages: packageIndexData(),
    };
  },
};
