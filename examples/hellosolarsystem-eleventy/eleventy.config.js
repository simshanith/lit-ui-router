import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { build } from 'vite';

const readJson = (file) =>
  JSON.parse(readFileSync(`node_modules/.build/${file}`, 'utf8'));

// A fresh process per render: importing the rebuilt module again would redefine the app's elements.
const render = () =>
  new Promise((resolve, reject) => {
    const child = spawn('node', ['render.js'], { stdio: 'inherit' });

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
    await build({ base: readJson('base.json') });
    await render();
  });

  eleventyConfig.addGlobalData('site', () => readJson('site.json'));

  eleventyConfig.addPassthroughCopy({
    'node_modules/.build/client/assets': 'assets',
  });

  return { dir: { input: 'site', output: 'dist' } };
}
