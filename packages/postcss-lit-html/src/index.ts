import postcssLit from 'postcss-lit';
import { getUserConfig } from 'postcss-lit/lib/userConfig.js';
import type { Document, Parser, ProcessOptions, Syntax } from 'postcss';

import {
  droppedBackslashes,
  type Layout,
  type Placed,
  relocate,
} from './positions.ts';
import { remember, stringify } from './stringify.ts';
import {
  type Span,
  type StyleElement,
  styleElements,
  stringsOf,
  templatesOf,
} from './templates.ts';
import { cssView } from './view.ts';

// postcss-lit chains `codeBefore` from one body's end to the next root's start
function placed(doc: Document, bodies: Span[]): Placed[] | undefined {
  const out: Placed[] = [];
  let end = 0;

  for (const root of doc.nodes) {
    const start = end + (root.raws.codeBefore ?? '').length;

    const body = bodies.find(
      (span) => span.start <= start && start <= span.end,
    );

    if (!body) return undefined;
    end = body.end;
    out.push({ root, start, end });
  }

  return out;
}

const skip = (from: string | undefined, why: string): void => {
  console.warn(
    '[postcss-lit-html]',
    `Skipping <style> elements (${from ?? 'unknown'}): ${why}`,
  );
};

/** A root for each `<style>` element, parsed from the file's CSS view. */
function styleRoots(
  source: string,
  styles: StyleElement[],
  opts: ProcessOptions | undefined,
): Placed[] | undefined {
  // SAFETY: postcss-lit's parse always returns a Document
  const view = postcssLit.parse(cssView(source, styles), opts) as Document;

  const roots = placed(
    view,
    styles.map(({ cssStart, cssEnd }) => ({ start: cssStart, end: cssEnd })),
  );

  for (const { root, start, end } of roots ?? []) {
    const style = styles.find((s) => s.cssStart <= start && start <= s.cssEnd);
    const holes = style?.expressions ?? [];

    // the view blanks each expression; stringify writes the source's back
    root.raws.litTemplateExpressions = holes.map((hole) =>
      source.slice(hole.start, hole.end),
    );

    if (root.source?.input) root.source.input.document = source;
    remember(root, source, { start, end }, holes);
  }

  return roots;
}

/** Makes `roots` the document's, with the code between them from the source. */
function adopt(doc: Document, roots: Placed[], source: string): void {
  let cursor = 0;

  for (const { root, start, end } of roots) {
    root.raws.codeBefore = source.slice(cursor, start);
    delete root.raws.codeAfter;
    root.parent = doc;
    // stylelint reads `root.document`, which postcss's types leave out
    Object.assign(root, { document: doc });
    cursor = end;
  }

  doc.nodes = roots.map(({ root }) => root);
  doc.nodes[doc.nodes.length - 1].raws.codeAfter = source.slice(cursor);
}

/** Adds a root for each `<style>` element to postcss-lit's `doc`, in source order; returns every root's span. */
function withStyles(
  doc: Document,
  source: string,
  opts: ProcessOptions | undefined,
): Layout {
  const { sites, cssBodies, cssStrings } = templatesOf(
    source,
    getUserConfig('postcss-lit').babelOptions,
  );

  const styles = /<style\b/i.test(source) ? styleElements(source, sites) : [];

  const dropped = droppedBackslashes(source, [
    ...cssStrings,
    ...styles.flatMap(stringsOf),
  ]);

  const fromSource = placed(doc, cssBodies);
  const plain: Layout = { placed: fromSource ?? [], dropped };

  if (styles.length === 0) return plain;
  let fromView: Placed[] | undefined;

  try {
    fromView = styleRoots(source, styles, opts);
  } catch (error) {
    skip(opts?.from, `the CSS view did not parse: ${String(error)}`);

    return plain;
  }

  if (!fromSource || !fromView) {
    skip(opts?.from, 'a template could not be placed');

    return plain;
  }

  const roots = [...fromSource, ...fromView].sort((a, b) => a.start - b.start);

  if (roots.some((root, i) => i > 0 && root.start <= roots[i - 1].end)) {
    skip(opts?.from, 'a template overlaps another');

    return plain;
  }

  // postcss-lit skipped every template, each with its own warning
  if (roots.length === 0) return plain;
  adopt(doc, roots, source);

  return { placed: roots, dropped };
}

/** Parses the CSS of a file's lit `css` templates and of the `<style>` elements in its `html` and `svg` templates. */
export const parse: Parser = (css, opts) => {
  const source = css.toString();
  // SAFETY: postcss-lit's parse always returns a Document
  const doc = postcssLit.parse(source, opts) as Document;

  const layout: Layout = /<style\b|\\\\/i.test(source)
    ? withStyles(doc, source, opts)
    : { placed: [], dropped: [] };

  relocate(doc, source, layout);

  return doc;
};

export { stringify };

const syntax: Syntax = { parse, stringify };

export default syntax;
