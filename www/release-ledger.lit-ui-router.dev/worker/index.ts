// Answers 404 to everything until the ledger's routes land.
export default {
  fetch: () => new Response(null, { status: 404 }),
} satisfies ExportedHandler<Env>;
