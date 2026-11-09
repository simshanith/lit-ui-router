import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

export function render({ content, base, redirect }) {
  const head = redirect
    ? `<meta http-equiv="refresh" content="0; url=${redirect}" />`
    : `<script type="module" src="${base}assets/client.js"></script>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="${base}" />
    <title>Hello Solar System on Eleventy</title>
    <style>${styles}</style>
    ${head}
  </head>
  <body>
    ${content}
  </body>
</html>
`;
}
