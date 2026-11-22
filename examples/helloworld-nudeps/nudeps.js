// `public/` is the whole site: nudeps copies dependencies into it and writes the import map beside them.
export default {
  dir: './public/client_modules',
  map: './public/client_modules/importmap.js',
  root: './public',
  prune: true,
  alias: false,
  ignore: ['**/*.d.ts', '**/*.map'],
  // Otherwise nudeps maps this package itself to `client_modules/public/main.js`, which does not exist.
  imports: {
    'lit-ui-router-tutorial-helloworld-nudeps': undefined,
  },
};
