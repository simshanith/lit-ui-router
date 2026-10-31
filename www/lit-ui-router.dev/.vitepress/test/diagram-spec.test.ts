import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  colorVar,
  darkStyleFor,
  type Element,
  FONT_BASE,
  FONT_MONO,
  markerFor,
  palette,
  parseDiagram,
  STYLE_HEAD,
} from './diagram-spec.ts';

// The rules live in docs/DIAGRAMS.md; each check below names the section it enforces.
const dir = join(import.meta.dirname, '../../public/diagrams');

const files = readdirSync(dir).filter((file) => file.endsWith('.svg'));

const COLOR_ATTRS = ['fill', 'stroke', 'stop-color', 'color'];

const OPACITY_ATTRS = ['opacity', 'fill-opacity', 'stroke-opacity'];

const where = (el: Element) => `line ${el.line} <${el.name}>`;

function strokeWidthProblems(el: Element): string[] {
  const width = el.attrs.get('stroke-width');

  if (width === undefined || el.inIcon) return [];

  const connector = el.attrs.has('marker-end') || el.attrs.has('marker-start');

  if (width === '1.25' && connector) return [];

  const halo =
    el.name === 'text' &&
    el.attrs.get('paint-order') === 'stroke' &&
    colorVar(el.attrs.get('stroke') ?? '')?.name === 'vp-c-bg';

  if (width === '4' && halo) return [];

  return [`${where(el)} stroke-width="${width}"`];
}

function radiusProblems(el: Element): string[] {
  if (el.name !== 'rect' || el.inIcon) return [];

  const rx = el.attrs.get('rx');

  if (el.attrs.has('ry')) return [`${where(el)} has ry`];

  if (rx === undefined) {
    const knockout =
      colorVar(el.attrs.get('fill') ?? '')?.name === 'vp-c-bg' &&
      !el.attrs.has('stroke');

    return knockout ? [] : [`${where(el)} has no rx`];
  }

  if (rx === '4' || rx === '8') return [];

  const { width, height } = Object.fromEntries(el.attrs);
  const circle = width === height && Number(rx) * 2 === Number(width);

  return circle ? [] : [`${where(el)} rx="${rx}"`];
}

function colorProblems(el: Element): string[] {
  const problems: string[] = [];

  for (const attr of COLOR_ATTRS) {
    const value = el.attrs.get(attr);

    if (value === undefined || value === 'none') continue;

    const role = colorVar(value);

    if (role) {
      const known = palette.get(role.name);

      if (!known) problems.push(`${where(el)} ${attr} uses --${role.name}`);
      else if (known.light !== role.fallback)
        problems.push(
          `${where(el)} ${attr} falls back to ${role.fallback}, not ${known.light}`,
        );
    } else if (!el.inBrand) problems.push(`${where(el)} ${attr}="${value}"`);
  }

  for (const attr of OPACITY_ATTRS)
    if (el.attrs.has(attr) && !el.inBrand)
      problems.push(`${where(el)} ${attr} outside a brand mark`);

  return problems;
}

for (const file of files) {
  const source = readFileSync(join(dir, file), 'utf8');
  const { root, style, elements } = parseDiagram(source);
  const drawn = elements.slice(1);

  describe(`diagram ${file}`, () => {
    it('sits on the 720-wide canvas with a title (Canvas)', () => {
      assert.equal(root.name, 'svg');
      assert.match(root.attrs.get('viewBox') ?? '', /^0 0 720 \d+$/);
      assert.equal(root.attrs.get('width'), '100%');
      assert.equal(root.attrs.get('style'), 'max-width: 720px');
      assert.equal(root.attrs.get('role'), 'img');
      assert.ok(root.attrs.get('aria-label'));
      assert.equal(drawn[0]?.name, 'title');
    });

    it('sets type in the two families, four sizes and one weight (Type)', () => {
      const problems = drawn.flatMap((el) => {
        const family = el.attrs.get('font-family');
        const size = el.attrs.get('font-size');
        const weight = el.attrs.get('font-weight');

        return [
          family && family !== FONT_BASE && family !== FONT_MONO
            ? `${where(el)} font-family="${family}"`
            : [],
          size && !['10', '11', '12', '13'].includes(size)
            ? `${where(el)} font-size="${size}"`
            : [],
          weight && weight !== '600'
            ? `${where(el)} font-weight="${weight}"`
            : [],
          el.attrs.has('letter-spacing') ? `${where(el)} letter-spacing` : [],
        ].flat();
      });

      assert.equal(
        drawn.find((el) => el.name === 'g')?.attrs.get('font-family'),
        FONT_BASE,
      );
      assert.deepEqual(problems, []);
    });

    it('draws connectors in text-2 with the one arrowhead (Lines)', () => {
      const markers = drawn.filter((el) => el.name === 'marker');

      const connectors = drawn.filter(
        (el) => el.attrs.has('marker-end') || el.attrs.has('marker-start'),
      );

      if (connectors.length === 0) {
        assert.equal(markers.length, 0);

        return;
      }

      assert.equal(markers.length, 1);

      const id = markers[0].attrs.get('id') ?? '';

      assert.ok(source.includes(markerFor(id)), 'marker matches the spec');

      const problems = connectors.flatMap((el) =>
        [
          ...['marker-end', 'marker-start'].map((attr) => {
            const ref = el.attrs.get(attr);

            return ref && ref !== `url(#${id})` ? `${where(el)} ${attr}` : [];
          }),
          colorVar(el.attrs.get('stroke') ?? '')?.name === 'vp-c-text-2'
            ? []
            : `${where(el)} stroke`,
          el.attrs.get('stroke-width') === '1.25'
            ? []
            : `${where(el)} stroke-width`,
        ].flat(),
      );

      assert.deepEqual(problems, []);
    });

    it('keeps to the stroke widths, dash and radii (Lines, Shapes)', () => {
      const problems = drawn.flatMap((el) =>
        [
          ...strokeWidthProblems(el),
          el.attrs.has('stroke-dasharray') &&
          el.attrs.get('stroke-dasharray') !== '5 4'
            ? `${where(el)} stroke-dasharray`
            : [],
          ...radiusProblems(el),
        ].flat(),
      );

      assert.deepEqual(problems, []);
    });

    it('colors only with palette roles, hex only in brand marks (Color)', () => {
      assert.deepEqual(drawn.flatMap(colorProblems), []);
    });

    it('carries a dark value for every role it uses (Color)', () => {
      const used = drawn.flatMap((el) =>
        COLOR_ATTRS.flatMap(
          (attr) => colorVar(el.attrs.get(attr) ?? '')?.name ?? [],
        ),
      );

      assert.equal(style, darkStyleFor(used));
      assert.ok(source.includes(`${STYLE_HEAD}\n  ${style}`));
    });
  });
}
