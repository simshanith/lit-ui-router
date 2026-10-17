// lit evaluates against whatever globals exist when it loads, so it loads only after the entry's shim.
const renderCard = async () => {
  const { html } = await import('lit');
  await import('./card.js');
  const { render } = await import('@lit-labs/ssr');
  const { collectResult } = await import('@lit-labs/ssr/lib/render-result.js');

  return collectResult(
    render(html`<canary-card heading="Hello">A post</canary-card>`),
  );
};

export const handler = {
  async fetch() {
    try {
      return new Response(await renderCard(), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    } catch (error) {
      return new Response(String(error?.stack ?? error), { status: 500 });
    }
  },
};
