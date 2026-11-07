export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({
    'node_modules/.build/client/assets': 'assets',
  });

  return { dir: { input: 'site', output: 'dist' } };
}
