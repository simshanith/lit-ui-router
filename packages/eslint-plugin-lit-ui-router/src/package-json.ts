// `import ... with { type: 'json' }` needs Node >=18.20 / >=20.10; createRequire
// runs on the whole `engines` range, which mirrors the eslint peer's.
import { createRequire } from 'node:module';

interface PackageJson {
  name: string;
  version: string;
  repository: { directory: string };
}

export const packageJson = createRequire(import.meta.url)(
  '../package.json',
) as PackageJson;
