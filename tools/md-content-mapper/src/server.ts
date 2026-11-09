#!/usr/bin/env node
// JSON-RPC over STDIO with LSP base-protocol framing (Content-Length headers).
import * as v from 'valibot';

import { initialize, transform, type MapperOptions } from './protocol.ts';

const RequestSchema = v.object({
  id: v.optional(v.union([v.number(), v.string()])),
  method: v.string(),
  params: v.optional(v.looseObject({})),
});

const ProjectSchema = v.object({
  projectHandle: v.string(),
  options: v.optional(v.object({ skip: v.optional(v.array(v.string())) }), {}),
});

const TransformSchema = v.object({
  fileName: v.string(),
  content: v.string(),
  projectHandle: v.string(),
});

type Request = v.InferOutput<typeof RequestSchema>;

type Response =
  | { result: object | null }
  | { error: { code: number; message: string } };

const projects = new Map<string, MapperOptions>();

const respond = ({ method, params }: Request): Response => {
  switch (method) {
    case 'initialize':
      return { result: initialize() };
    case 'openProject': {
      const { projectHandle, options } = v.parse(ProjectSchema, params);

      projects.set(projectHandle, options);

      return { result: {} };
    }

    case 'transform': {
      const request = v.parse(TransformSchema, params);

      return {
        result: transform(request, projects.get(request.projectHandle)),
      };
    }

    case 'closeProject':
      projects.delete(v.parse(ProjectSchema, params).projectHandle);

      return { result: null };
    default:
      return { error: { code: -32601, message: `unknown method ${method}` } };
  }
};

type Message = Response & { id: number | string };

const send = (message: Message): void => {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', ...message }));

  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
};

const handle = (request: Request): void => {
  if (request.id === undefined) return;

  try {
    send({ id: request.id, ...respond(request) });
  } catch (error) {
    send({ id: request.id, error: { code: -32603, message: String(error) } });
  }
};

const main = (): void => {
  let buffer = Buffer.alloc(0);

  process.stdin.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);

    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n');

      if (headerEnd === -1) return;

      const length = /Content-Length: (\d+)/i.exec(
        buffer.subarray(0, headerEnd).toString('ascii'),
      )?.[1];

      const bodyStart = headerEnd + 4;

      const bodyEnd = bodyStart + Number(length);

      if (length === undefined || buffer.length < bodyEnd) return;

      handle(
        v.parse(
          RequestSchema,
          JSON.parse(buffer.subarray(bodyStart, bodyEnd).toString('utf8')),
        ),
      );
      buffer = buffer.subarray(bodyEnd);
    }
  });
};

if (import.meta.main) main();
