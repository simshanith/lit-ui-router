import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  type Binding,
  type LowerContext,
  lowerFile,
  type Span,
  type TemplateSite,
  segmentAt,
  toOriginal,
} from './lower.ts';

// A stand-in for ./sites.ts: scans `html`…`` sites, nested ones included.
function sitesOf(source: string): TemplateSite[] {
  const sites: TemplateSite[] = [];

  const template = (tagStart: number, tick: number): number => {
    const strings: Span[] = [];
    const expressions: Binding[] = [];
    let start = tick + 1;
    let i = start;

    while (source[i] !== '`') {
      if (source[i] === '\\') i += 2;
      else if (source.startsWith('${', i)) {
        strings.push({ start, end: i });
        const exprStart = i + 2;
        i = expression(exprStart);

        const callee = /^([A-Za-z_$][\w$]*)\(/.exec(
          source.slice(exprStart, i),
        )?.[1];

        // a whole-expression call of a name stands for its one argument
        const args = callee
          ? [{ start: exprStart + callee.length + 1, end: i - 1 }]
          : undefined;

        expressions.push({
          start: exprStart,
          end: i,
          ...(callee && { callee, args }),
        });
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

const lower = (source: string, context?: LowerContext) =>
  lowerFile(source, sitesOf(source), 'lit', context);

const reports = (text: string) =>
  [...text.matchAll(/__ltc\.report<("(?:[^"\\]|\\.)*")>/g)].map(([, message]) =>
    String(JSON.parse(message)),
  );

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
      /__ltc\.attr\(__ltc\.el<"a">\(\), "href"\), __ltc\.value\(__ltc\.el<"a">\(\), "href", \(h\), true, __ltc\.as<string>\(\)\)/,
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
    assert.match(
      text,
      /__ltc\.value\(__ltc\.el<"li">\(\), "title", \(i\.name\), true/,
    );
  });

  it('marks the next element checks with a directive comment', () => {
    const source = 'html`<!-- @ts-expect-error --><ui-veiw></ui-veiw><p></p>`';
    const { text, segments, directives } = lower(source);

    assert.deepEqual(directives, [
      { kind: 'expect-error', at: source.indexOf('<!--') },
    ]);
    assert.equal(
      segmentAt(segments, text.indexOf('__ltc.tag("ui-veiw")'))?.directive,
      0,
    );
    assert.equal(
      segmentAt(segments, text.indexOf('__ltc.tag("p")'))?.directive,
      undefined,
    );
  });

  it('keeps a trailing directive comment in its own template', () => {
    const { text, segments, directives } = lower(
      'x = html`<!-- @ts-expect-error -->`; y = html`<p></p>`',
    );

    assert.equal(directives.length, 1);
    assert.equal(
      segmentAt(segments, text.indexOf('__ltc.tag("p")'))?.directive,
      undefined,
    );
  });

  it('checks foreignObject content as HTML', () => {
    const { text } = lower(
      'html`<svg><foreignObject><div></div></foreignObject></svg>`',
    );

    assert.match(text, /__ltc\.svgTag\("foreignObject"\)/);
    assert.match(text, /__ltc\.tag\("div"\)/);
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
    assert.match(text, /__ltc\.primitive\(\(d\)\)/);
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

describe('lowerFile structure reports', () => {
  it('reports an element with content and no end tag', () => {
    const { text } = lower(
      'html`<ul><li>a<li>b</ul><x-el />t<br><span></span>`',
    );

    assert.deepEqual(reports(text), [
      "This tag isn't closed.",
      "This tag isn't closed.",
      "This tag isn't closed. Custom elements cannot be self closing.",
    ]);
  });

  it('reports a custom tag the file does not import', () => {
    const { text } = lower('html`<x-el></x-el><y-el></y-el>`', {
      missingImport: (tag) => tag === 'x-el',
    });

    assert.deepEqual(reports(text), ['Missing import for <x-el>']);
  });

  it('checks slot names against the parent element', () => {
    const slots = new Map([
      ['x-el', ['', 'header']],
      ['y-el', ['header']],
    ]);

    const { text } = lower(
      'html`<x-el><b></b><i slot="header"></i><u slot="foot"></u></x-el><y-el><b></b></y-el>`',
      { slots },
    );

    assert.deepEqual(reports(text), [
      "Invalid slot name 'foot'. Valid slot names for <x-el> are: '' | 'header'",
      'Missing slot attribute. Parent element <y-el> only allows named slots as children.',
    ]);
  });
});

describe('lowerFile binding reports', () => {
  it('reports a binding prefix with no expression', () => {
    const { text } = lower('html`<a .x="1" ?y @z="f"></a>`');

    assert.deepEqual(reports(text), [
      'You are using a property binding without an expression',
      'You are using a boolean attribute binding without an expression',
      'You are using an event listener binding without an expression',
    ]);
  });

  it('reports a quote, brace or slash straight after a binding', () => {
    const { text } = lower(
      "html`<a title=${a}' .b=${b}} ?c=${c}/ @d=${d}'></a>`",
    );

    assert.deepEqual(reports(text), [
      'This binding is directly followed by an unmatched "\'" which is probably unintended.',
      "This binding is directly followed by an unmatched '}' which is probably unintended.",
      "This binding is directly followed by a '/' which is probably unintended.",
    ]);
  });

  it('types an interpolated property or boolean binding as a string', () => {
    const { text } = lower('html`<a .title="a${x}" ?hidden="${y}b"></a>`');

    assert.match(
      text,
      /__ltc\.prop\(__ltc\.el<"a">\(\), "title", __ltc\.text\)/,
    );
    assert.match(
      text,
      /__ltc\.bool\(__ltc\.el<"a">\(\), "hidden", __ltc\.text\)/,
    );
  });

  it('reports directives in parts they have no effect in', () => {
    const { text } = lower(
      'html`<a .x=${ifDefined(v)} @y=${live(f)} title=${classMap(c)} class=${styleMap(s)} ?z=${repeat(r)}>${classMap(c)}</a>`',
    );

    assert.deepEqual(reports(text), [
      "The 'ifDefined' directive has no effect here.",
      "The 'live' directive can only be used in attribute and property bindings",
      "The 'classMap' directive can only be used in an attribute binding for the 'class' attribute",
      "The 'styleMap' directive can only be used in an attribute binding for the 'style' attribute",
      "The 'repeat' directive can only be used within a text binding.",
    ]);
  });

  it('checks live() in an attribute by its argument', () => {
    const { text } = lower('html`<input value=${live(v)}>`');

    assert.match(text, /__ltc\.live\(\(v\), true\)/);
    assert.match(
      text,
      /__ltc\.valueOf\(__ltc\.el<"input">\(\), "value", \(v\), true/,
    );
  });
});

describe('lowerFile attribute values', () => {
  it('checks a static value against the html data', () => {
    const { text } = lower('html`<div dir="sideways"></div>`');

    assert.match(
      text,
      /__ltc\.value\(__ltc\.el<"div">\(\), "dir", "sideways", true, __ltc\.as<"ltr" \| "rtl" \| "auto">\(\)\)/,
    );
  });

  it('checks a valueless attribute as present', () => {
    const { text } = lower('html`<input disabled>`');

    assert.match(
      text,
      /__ltc\.present\(__ltc\.el<"input">\(\), "disabled", true, __ltc\.as<boolean>\(\)\)/,
    );
  });

  it('checks an interpolated value as a string', () => {
    const { text } = lower('html`<div dir="${a}${b}"></div>`');

    assert.match(text, /__ltc\.primitive\(\(a\)\)/);
    assert.match(
      text,
      /__ltc\.value\(__ltc\.el<"div">\(\), "dir", __ltc\.text, true/,
    );
  });

  it('leaves an untyped built-in attribute unchecked', () => {
    const { text } = lower('html`<div data-x="1"></div>`');

    assert.doesNotMatch(text, /__ltc\.value/);
  });

  it('checks every attribute of a custom element against its properties', () => {
    const { text } = lower('html`<x-el count="3"></x-el>`');

    assert.match(
      text,
      /__ltc\.value\(__ltc\.el<"x-el">\(\), "count", "3", true\)/,
    );
  });
});

describe('lowerFile insertions', () => {
  it('splices a check in at its offset, mapped to its origin', () => {
    const source = 'class A { b = 1; }';
    const at = source.lastIndexOf('}');

    const { text, segments } = lower(source, {
      insertions: [
        { at, text: 'CHECK ', originalStart: 4, rule: 'property-type' },
      ],
    });

    assert.match(body(text), /^class A \{ b = 1; CHECK \}$/);
    const mapped = toOriginal(segments, text.indexOf('CHECK'));

    assert.equal(mapped?.offset, 4);
    assert.equal(mapped?.segment.report, true);
  });
});
