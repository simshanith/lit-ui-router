import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { expect, it } from 'vitest';

const src = fileURLToPath(new URL('..', import.meta.url));

it('keeps the element, lit and d3 out of the lazy entry until mount()', async () => {
  const bundle = await rolldown({
    input: fileURLToPath(new URL('../lazy.ts', import.meta.url)),
    external: (id) => id.startsWith('@uirouter/core'),
  });

  const { output } = await bundle.generate({ format: 'es' });
  const chunks = output.filter((chunk) => chunk.type === 'chunk');
  const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const eager = new Set([chunks[0].fileName]);

  for (const file of eager)
    for (const imported of byFile.get(file)?.imports ?? []) eager.add(imported);

  const modules = [...eager].flatMap((file) =>
    (byFile.get(file)?.moduleIds ?? []).map((id) =>
      id.startsWith(src) ? id.slice(src.length) : id,
    ),
  );

  expect(modules).toContain('lazy.ts');
  expect(modules).toContain('recorder.ts');
  expect(
    modules.filter((id) =>
      /^(element\/|define\.ts|ui-router-devtools\.ts)|node_modules\/(lit|@lit|lit-html|lit-element|d3-hierarchy|valibot)\//.test(
        id,
      ),
    ),
  ).toEqual([]);
  // The element still ships, behind the dynamic import.
  expect(
    chunks.some((chunk) =>
      chunk.moduleIds.some((id) => id.endsWith('/define.ts')),
    ),
  ).toBe(true);
});
