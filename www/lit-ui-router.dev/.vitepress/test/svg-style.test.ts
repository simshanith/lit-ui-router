import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { describe, it } from 'node:test';

import { createMarkdownRenderer } from 'vitepress';

import { stripInlineSvgStyles } from '../svg-style.ts';

const md = await createMarkdownRenderer(dirname(import.meta.dirname), {
  config: stripInlineSvgStyles,
});

const svg = `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
  <title>Flow</title>
  <style>
    @media (prefers-color-scheme: dark) {
      svg:root { --vp-c-text-1: #dfdfd6; }
    }
  </style>
  <text fill="var(--vp-c-text-1, #3c3c43)">verdict</text>
</svg>
`;

describe('stripInlineSvgStyles', () => {
  it("drops an inline diagram's <style> and keeps the rest byte for byte", async () => {
    const html = await md.renderAsync(`# Guide\n\n${svg}`, {});

    assert.ok(!html.includes('<style'));
    assert.ok(
      html.includes(
        '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">\n  <title>Flow</title>\n  <text fill="var(--vp-c-text-1, #3c3c43)">verdict</text>\n</svg>',
      ),
    );
  });

  it('leaves <style> outside an svg block alone', async () => {
    const html = await md.renderAsync(
      '<div>\n  <style>p {}</style>\n</div>\n',
      {},
    );

    assert.ok(html.includes('<style>p {}</style>'));
  });
});
