import { describe, expect, it } from 'vitest';

import {
  comments,
  element,
  elements,
  getAttribute,
  outline,
  parseMarkup,
  text,
} from '../ssr-tree.ts';

const markup =
  '<x-host defer-hydration><template shadowrootmode="open"><!--lit-part a--><slot></slot><!--/lit-part--></template>' +
  '<p class="light"><!--lit-part-->light<!--/lit-part--></p><?></x-host>';

describe('the parse5 SSR tree helpers', () => {
  it('outlines children in order, comments kept and template contents read as children', () => {
    const host = element(parseMarkup(markup), 'x-host');

    expect(outline(host)).toEqual(['<template>', '<p>', '<!--?-->']);
    expect(outline(element(host, 'template'))).toEqual([
      '<!--lit-part a-->',
      '<slot>',
      '<!--/lit-part-->',
    ]);
  });

  it('finds elements by tag and attribute values, inside template contents too', () => {
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
      'lit-part a',
      '/lit-part',
      'lit-part',
      '/lit-part',
      '?',
    ]);
  });
});
