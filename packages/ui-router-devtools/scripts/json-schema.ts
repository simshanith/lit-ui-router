#!/usr/bin/env node
// Writes dist/session.schema.json, the session file's JSON Schema, from the valibot schema the panel imports with.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { toJsonSchema } from '@valibot/to-json-schema';

import { eventSchemas, sessionSchema } from '../src/session-schema.ts';

const OUT = fileURLToPath(
  new URL('../dist/session.schema.json', import.meta.url),
);

// The input side: an open enum documents its known values and accepts others, before any fallback the panel applies.
export const sessionJsonSchema = () => {
  const { $schema, ...schema } = toJsonSchema(sessionSchema(), {
    target: 'draft-2020-12',
    typeMode: 'input',
    definitions: { ...eventSchemas() },
  });

  return {
    $schema,
    title: 'ui-router-devtools session',
    description:
      'A recorded UI-Router session, schema v1. A v1 reader ignores fields and event types it does not know and tolerates values it does not know of an open enum, written as `anyOf` the known values and any string; `format` identifies the file.',
    ...schema,
  };
};

const main = () => {
  mkdirSync(fileURLToPath(new URL('../dist/', import.meta.url)), {
    recursive: true,
  });
  writeFileSync(OUT, `${JSON.stringify(sessionJsonSchema(), null, 2)}\n`);
};

if (import.meta.main) main();
