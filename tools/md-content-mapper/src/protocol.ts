// The content mapper protocol from microsoft/typescript-go PR 4712; the typescript package ships no mapper-side types.
import { extractBlocks } from './blocks.ts';

/** SpanMapKind.Verbatim */
const VERBATIM = 0;

export type SpanMapping = [
  virtualStart: number,
  virtualLength: number,
  originalStart: number,
  originalLength: number,
  kind: number,
];

export interface MappedOutput {
  text: string;
  extension: '.ts';
  mappings?: SpanMapping[];
}

export interface TransformResult extends MappedOutput {
  supplemental?: MappedOutput[];
}

export interface MapperOptions {
  /** `<absolute file>:<fence line>` keys of blocks to leave out, as `check` passes them. */
  skip?: string[];
}

export interface OpenProjectParams {
  projectHandle: string;
  options?: MapperOptions;
}

export interface TransformParams {
  fileName: string;
  content: string;
  projectHandle: string;
}

export const blockKey = (fileName: string, line: number): string =>
  `${fileName}:${line}`;

export interface InitializeResult {
  protocolVersion: number;
  positionEncoding: 'utf-16';
  diagnosticSource: string;
}

export const initialize = (): InitializeResult => ({
  protocolVersion: 1,
  positionEncoding: 'utf-16',
  diagnosticSource: 'md-content-mapper',
});

/** The canonical output is empty; each checked fence becomes its own supplemental module. */
export const transform = (
  { content, fileName }: TransformParams,
  options: MapperOptions = {},
): TransformResult => {
  const skip = new Set(options.skip);

  return {
    text: '',
    extension: '.ts',
    supplemental: extractBlocks(content)
      .filter(
        (block) => !block.skip && !skip.has(blockKey(fileName, block.line)),
      )
      .map((block) => ({
        text: block.text,
        extension: '.ts',
        mappings: block.spans.map(
          ([virtual, length, original]): SpanMapping => [
            virtual,
            length,
            original,
            length,
            VERBATIM,
          ],
        ),
      })),
  };
};
