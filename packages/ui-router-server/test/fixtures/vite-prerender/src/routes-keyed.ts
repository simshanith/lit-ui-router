import { mounts } from './routes.ts';

// The same table keyed by the base, as a site that names its mount once would write it.
export const keyedMounts = { '/app/': mounts['/'] };
