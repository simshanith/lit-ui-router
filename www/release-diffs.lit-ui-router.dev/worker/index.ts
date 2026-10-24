// Answers 404 to everything until the ReleaseDiff Durable Object lands.
export default {
  fetch: () => new Response(null, { status: 404 }),
} satisfies ExportedHandler<Env>;
