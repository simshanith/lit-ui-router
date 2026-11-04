import { describe, expect, it } from 'vitest';

import {
  comments,
  element,
  elements,
  getAttribute,
  lightChildren,
  litPart,
  outline,
  parseMarkup,
  shadowRoot,
  outlineTree,
  text,
} from '../ssr-tree.ts';

const markup =
  '<x-host defer-hydration><template shadowroot="open" shadowrootmode="open"><!--lit-part a=--><slot></slot><!--/lit-part--></template>' +
  '<p class="light"><!--served:lit-part-->light<!--served:/lit-part--></p><?></x-host>';

const host = () => element(parseMarkup(markup), 'x-host');

describe('the parse5 SSR tree helpers', () => {
  it('outlines a host’s own children, its shadow root a template with no children of its own', () => {
    expect(outline(host())).toEqual(['<template>', '<p>', '<!--?-->']);
    expect(outline(element(host(), 'template'))).toEqual([]);
  });

  it('separates the shadow root from the light children', () => {
    expect(outline(shadowRoot(host()))).toEqual([
      '<!--lit-part a=-->',
      '<slot>',
      '<!--/lit-part-->',
    ]);
    expect(lightChildren(host()).map((node) => node.nodeName)).toEqual([
      'p',
      '#comment',
    ]);
  });

  it('throws for a host with no declarative shadow root', () => {
    expect(() => shadowRoot(element(host(), 'p'))).toThrow(
      '<p> has no shadow root',
    );
    expect(() =>
      shadowRoot(
        element(parseMarkup('<x-a><template></template></x-a>'), 'x-a'),
      ),
    ).toThrow('<x-a> has no shadow root');
  });

  it('finds elements by tag and attribute values, inside shadow roots too', () => {
    const tree = parseMarkup(markup);

    expect(elements(tree, 'slot')).toHaveLength(1);
    expect(elements(tree, 'p', { class: 'light' })).toHaveLength(1);
    expect(elements(tree, 'p', { class: 'dark' })).toHaveLength(0);
    expect(() => element(tree, 'p', { class: 'dark' })).toThrow(
      'no <p> with {"class":"dark"} in the markup',
    );
  });

  it('reads attributes, text without comments, and comment data', () => {
    const tree = parseMarkup(markup);

    expect(getAttribute(element(tree, 'x-host'), 'defer-hydration')).toBe('');
    expect(getAttribute(element(tree, 'p'), 'class')).toBe('light');
    expect(text(tree)).toBe('light');
    expect(comments(tree)).toEqual([
      'lit-part a=',
      '/lit-part',
      'served:lit-part',
      'served:/lit-part',
      '?',
    ]);
  });

  it('reads each Lit marker kind, and nothing else', () => {
    const [open, node, bare, close, served, other] = lightChildren(
      element(
        parseMarkup(
          '<x-a><!--lit-part BRUAAAUVAAA=--><!--lit-node 2--><!--lit-part--><!--/lit-part--><!--served:/lit-part--><!--?-->text</x-a>',
        ),
        'x-a',
      ),
    );

    expect(litPart(open)).toEqual({
      kind: 'open',
      digest: 'BRUAAAUVAAA=',
      prefix: '',
    });
    expect(litPart(node)).toEqual({ kind: 'node', index: 2, prefix: '' });
    expect(litPart(bare)).toEqual({ kind: 'open', digest: null, prefix: '' });
    expect(litPart(close)).toEqual({ kind: 'close', prefix: '' });
    expect(litPart(served)).toEqual({ kind: 'close', prefix: 'served:' });
    expect(litPart(other)).toBeNull();
    expect(litPart(element(host(), 'p'))).toBeNull();
  });

  it('writes any digest as `*` when asked to leave digests out', () => {
    expect(outlineTree(shadowRoot(host()), { digests: false })).toEqual([
      '{open *}',
      '<slot>',
      '{close}',
    ]);
  });

  it('outlines a whole subtree: shadow roots marked, markers named, blank text left out', () => {
    expect(
      outlineTree(parseMarkup(`${markup}\n  <span> spaced </span>`)),
    ).toEqual([
      '<x-host defer-hydration>',
      '  #shadow open',
      '    {open a=}',
      '    <slot>',
      '    {close}',
      '  <p class="light">',
      '    served:{open}',
      '    "light"',
      '    served:{close}',
      '  <!--?-->',
      '<span>',
      '  "spaced"',
    ]);
  });
});
