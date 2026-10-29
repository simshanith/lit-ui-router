import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  lowerFile,
  type Span,
  type TemplateSite,
  toOriginal,
} from './lower.ts';

// A stand-in for ./sites.ts: scans `html`…`` sites, nested ones included.
function sitesOf(source: string): TemplateSite[] {
  const sites: TemplateSite[] = [];

  const template = (tagStart: number, tick: number): number => {
    const strings: Span[] = [];
    const expressions: Span[] = [];
    let start = tick + 1;
    let i = start;

    while (source[i] !== '`') {
      if (source[i] === '\\') i += 2;
      else if (source.startsWith('${', i)) {
        strings.push({ start, end: i });
        const exprStart = i + 2;
        i = expression(exprStart);
        expressions.push({ start: exprStart, end: i });
        start = i + 1;
        i = start;
      } else i += 1;
    }

    strings.push({ start, end: i });
    sites.push({
      start: tagStart,
      end: i + 1,
      tag: 'html',
      strings,
      expressions,
    });

    return i + 1;
  };

  const expression = (from: number): number => {
    let depth = 0;
    let i = from;

    while (depth > 0 || source[i] !== '}') {
      if (source.startsWith('html`', i)) i = template(i, i + 4);
      else {
        if (source[i] === '{') depth += 1;

        if (source[i] === '}') depth -= 1;
        i += 1;
      }
    }

    return i;
  };

  for (
    let i = source.indexOf('html`');
    i >= 0;
    i = source.indexOf('html`', i)
  ) {
    i = template(i, i + 4);
  }

  return sites;
}

const lower = (source: string) => lowerFile(source, sitesOf(source), 'lit');

const body = (text: string) => text.slice(0, text.indexOf('\ndeclare module'));

describe('lowerFile', () => {
  it('keeps a property binding name in its source case', () => {
    const { text, stats } = lower(
      'const t = html`<my-el .fooBar=${x}></my-el>`;',
    );

    assert.match(
      text,
      /__ltc\.prop\(__ltc\.el<"my-el">\(\), "fooBar", \(x\)\)/,
    );
    assert.equal(stats.lowered.property, 1);
  });

  it('lowers each binding kind to its helper', () => {
    const { text } = lower(
      'html`<a ${ref(r)} href=${h} ?hidden=${b} @click=${f}>${c}</a>`',
    );

    assert.match(text, /__ltc\.tag\("a"\)/);
    assert.match(text, /__ltc\.element\(\(ref\(r\)\)\)/);
    assert.match(
      text,
      /__ltc\.attr\(__ltc\.el<"a">\(\), "href"\), __ltc\.value\(\(h\)\)/,
    );
    assert.match(text, /__ltc\.bool\(__ltc\.el<"a">\(\), "hidden", \(b\)\)/);
    assert.match(text, /__ltc\.on\(__ltc\.el<"a">\(\), "click", \(f\)\)/);
    assert.match(text, /__ltc\.child\(\(c\)\)/);
  });

  it('replaces the template with checks and an empty template of the same type', () => {
    const { text } = lower('const t = html`<p></p>`;');

    assert.match(body(text), /^const t = \(\n__ltc\.tag\("p"\), \nhtml``\);$/);
  });

  it('maps a copied expression back position for position', () => {
    const source = 'html`<input .value=${this.count + 1}>`';
    const { text, segments } = lower(source);
    const virtual = text.indexOf('this.count');
    const mapped = toOriginal(segments, virtual + 5);

    assert.equal(mapped?.offset, source.indexOf('this.count') + 5);
    assert.equal(mapped?.segment.rule, 'property-binding');
  });

  it('maps a synthesized name to its attribute in the source', () => {
    const source = 'html`<ui-view nmae="x"></ui-view>`';
    const { text, segments } = lower(source);
    const mapped = toOriginal(segments, text.indexOf('"nmae"'));

    assert.equal(mapped?.offset, source.indexOf('nmae'));
    assert.equal(mapped?.segment.rule, 'unknown-attribute');
  });

  it('lowers a template nested in an expression where it stands', () => {
    const { text, stats } = lower(
      'html`<ul>${items.map((i) => html`<li title=${i.name}></li>`)}</ul>`',
    );

    assert.equal(stats.templates, 2);
    assert.match(text, /items\.map\(\(i\) => \(\n__ltc\.tag\("li"\)/);
    assert.match(text, /__ltc\.value\(\(i\.name\)\)/);
  });

  it('turns a directive comment into a directive on the next element', () => {
    const source = 'html`<!-- @ts-expect-error --><ui-veiw></ui-veiw>`';
    const { text, segments } = lower(source);

    assert.match(text, /\n\/\/ @ts-expect-error\n__ltc\.tag\("ui-veiw"\)/);
    assert.equal(
      toOriginal(segments, text.indexOf('// @ts-expect-error'))?.offset,
      source.indexOf('<!--'),
    );
  });

  it('parses table parts in a template context, as lit does', () => {
    const { text } = lower('html`<td>${x}</td>`');

    assert.match(text, /__ltc\.tag\("td"\)/);
  });

  it('checks no attribute names on svg', () => {
    const { text, stats } = lower(
      'html`<svg viewBox="0 0 1 1"><path d=${d}></path></svg>`',
    );

    assert.match(text, /__ltc\.svgTag\("path"\)/);
    assert.equal(stats.skipped['svg-attribute-name'], 2);
    assert.match(text, /__ltc\.value\(\(d\)\)/);
  });

  it('leaves code outside the templates unmapped', () => {
    const { segments } = lower('const a = 1; html`<p></p>`');

    assert.equal(toOriginal(segments, 2), undefined);
  });

  it('counts the directive a binding calls', () => {
    const { stats } = lower('html`<a class=${classMap({ a: true })}></a>`');

    assert.equal(stats.directives.classMap, 1);
  });
});
