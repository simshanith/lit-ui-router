import { readFileSync } from 'node:fs';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

export function render({ content, title, route, base }) {
  const redirect = route?.kind === 'redirect';

  const refresh = redirect
    ? `<meta http-equiv="refresh" content="0; url=${base}${route.location.replace(/^\//, '')}" />`
    : '';

  const client = redirect
    ? ''
    : `<script type="module" src="${base}assets/client.js"></script>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <base href="${base}" />
    ${refresh}
    <title>${title}</title>
    <style>${styles}</style>
  </head>
  <body>
    ${content}
    ${client}
  </body>
</html>
`;
}
