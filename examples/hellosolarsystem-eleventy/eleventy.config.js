import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { build } from 'vite';

// A fresh process per render: importing the rebuilt module again would redefine the app's elements.
const render = (base) =>
  new Promise((resolve, reject) => {
    const child = spawn('node', ['render.js', base], { stdio: 'inherit' });

    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`render.js exited ${code}`)),
    );
  });

export default function (eleventyConfig) {
  // Saves under src/ rebuild the app, then render it again, under --serve.
  eleventyConfig.addWatchTarget('./src/');

  eleventyConfig.on('eleventy.before', async () => {
    await build({ build: { ssr: true } });
    await build({ base: eleventyConfig.pathPrefix });
    await render(eleventyConfig.pathPrefix);
  });

  // The path the site is served under: `/`, or `/examples/<name>/` in the docs site, from `--pathprefix`.
  eleventyConfig.addGlobalData('base', () => eleventyConfig.pathPrefix);

  eleventyConfig.addGlobalData('site', () =>
    JSON.parse(readFileSync('node_modules/.build/site.json', 'utf8')),
  );

  eleventyConfig.addPassthroughCopy({
    'node_modules/.build/client/assets': 'assets',
  });

  return { dir: { input: 'site', output: 'dist' } };
}
