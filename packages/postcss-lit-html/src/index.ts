import postcssLit from 'postcss-lit';
import { getUserConfig } from 'postcss-lit/lib/userConfig.js';
import type {
  Document,
  Parser,
  ProcessOptions,
  Root,
  Stringifier,
  Syntax,
} from 'postcss';

import { relocate } from './positions.ts';
import {
  type Span,
  type StyleElement,
  styleElements,
  templatesOf,
} from './templates.ts';
import { cssView } from './view.ts';

interface Placed {
  root: Root;
  start: number;
  end: number;
}

/**
 * Where each root's CSS starts and its template body ends. postcss-lit chains
 * `codeBefore` from one body's end to the next root's start.
 */
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
  const view = postcssLit.parse(cssView(source, styles), opts);

  if (view.type !== 'document') return undefined;

  const roots = placed(
    view,
    styles.map(({ cssStart, cssEnd }) => ({ start: cssStart, end: cssEnd })),
  );

  for (const { root, start } of roots ?? []) {
    const style = styles.find((s) => s.cssStart <= start && start <= s.cssEnd);

    // the view blanks each expression; stringify writes the source's back
    root.raws.litTemplateExpressions = (style?.expressions ?? []).map((hole) =>
      source.slice(hole.start, hole.end),
    );

    if (root.source?.input) root.source.input.document = source;
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

/** postcss-lit's Document, plus a root for each `<style>` element, in source order. */
function withStyles(source: string, opts: ProcessOptions | undefined) {
  const doc = postcssLit.parse(source, opts);

  if (doc.type !== 'document' || !/<style\b/i.test(source)) return doc;

  const { sites, cssBodies } = templatesOf(
    source,
    getUserConfig('postcss-lit').babelOptions,
  );

  const styles = styleElements(source, sites);

  if (styles.length === 0) return doc;
  const fromSource = placed(doc, cssBodies);
  const fromView = styleRoots(source, styles, opts);

  if (!fromSource || !fromView) {
    skip(opts?.from, 'a template could not be placed');

    return doc;
  }

  const roots = [...fromSource, ...fromView].sort((a, b) => a.start - b.start);

  if (roots.some((root, i) => i > 0 && root.start <= roots[i - 1].end)) {
    skip(opts?.from, 'a template overlaps another');

    return doc;
  }

  adopt(doc, roots, source);

  return doc;
}

/**
 * Parses the CSS of a file's lit `css` templates and of the `<style>`
 * elements in its `html` and `svg` templates.
 */
export const parse: Parser = (css, opts) => {
  const source = css.toString();
  const doc = withStyles(source, opts);

  relocate(doc, source);

  return doc;
};

export const stringify: Stringifier = postcssLit.stringify;

const syntax: Syntax = { parse, stringify };

export default syntax;
