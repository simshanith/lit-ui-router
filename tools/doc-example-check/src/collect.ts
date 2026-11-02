import type { API } from 'typescript/sync';
import { isJSDoc, type Node } from 'typescript/ast';

import {
  commentLines,
  extractFences,
  type ExampleBlock,
  type Mode,
} from './blocks.ts';

export interface FileExamples {
  /** Every `@example` tag the parser attached to a declaration. */
  tags: number;
  /** 1-based lines of `@example` tags that hold no fence. */
  unfenced: number[];
  blocks: ExampleBlock[];
}

/** `[pos, end)` of each `@example` tag the parser attached, in source order. */
const exampleTagRanges = (root: Node): [number, number][] => {
  const ranges = new Map<number, number>();

  const visit = (node: Node): void => {
    for (const doc of node.jsDoc ?? []) {
      if (!isJSDoc(doc)) continue;

      for (const tag of doc.tags ?? []) {
        if (tag.tagName.text === 'example') ranges.set(tag.pos, tag.end);
      }
    }

    node.forEachChild(visit);
  };

  visit(root);

  return [...ranges].sort(([a], [b]) => a - b);
};

const lineOf = (source: string, pos: number): number =>
  source.slice(0, pos).split('\n').length;

/** Parses `source` with the TypeScript 7 parser and extracts its `@example` blocks. */
export const collectExamples = (
  api: API,
  fileName: string,
  source: string,
  mode: Mode,
): FileExamples => {
  using retained = api.createSourceFile(fileName, source);
  const ranges = exampleTagRanges(retained.sourceFile);

  const result: FileExamples = {
    tags: ranges.length,
    unfenced: [],
    blocks: [],
  };

  for (const [pos, end] of ranges) {
    const { blocks, fenced } = extractFences(
      commentLines(source, pos, end),
      mode,
    );

    if (!fenced) result.unfenced.push(lineOf(source, pos));

    result.blocks.push(...blocks);
  }

  return result;
};
