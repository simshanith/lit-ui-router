// The runtime's constructor throw, statically (#667). Each directive accepts
// exactly one part type and throws on every other, which is a render-time
// failure a lint run can catch at author time.
import type { RuleFor } from './rule-shape.ts';
import { TemplateAnalyzer } from 'eslint-plugin-lit/lib/template-analyzer.js';
import {
  asNode,
  asNodes,
  type AttributePart,
  attributePartsOf,
  createDirectiveTracker,
  type DirectiveName,
  elementPartIndex,
  importedAs,
} from './directives.ts';

/**
 * The part type each directive accepts. This table is the single place a new
 * directive goes, and the checks below branch on the value rather than assuming
 * every directive is element-only.
 */
const ALLOWED_POSITION: Record<DirectiveName, 'element' | 'attribute'> = {
  uiSref: 'element',
  uiSrefActive: 'element',
  srefHref: 'attribute',
  srefActiveClass: 'attribute',
  srefAriaCurrent: 'attribute',
};

/** Attribute-part directives that additionally accept one attribute and no other. */
const ALLOWED_ATTRIBUTE: Partial<Record<DirectiveName, string>> = {
  srefActiveClass: 'class',
};

/**
 * Attribute-part directives that must be the *whole* value, not merely the only
 * expression: their constructors reject `strings` outright, where
 * `srefActiveClass` follows classMap and keeps the static classes around it.
 */
const WHOLE_VALUE: Partial<Record<DirectiveName, true>> = {
  srefHref: true,
  srefAriaCurrent: true,
};

export const RULE_NAME = 'directive-position';

/** Modules whose `html` splices static values into the strings before lit parses. */
const STATIC_HTML_SOURCES = new Set([
  'lit/static-html.js',
  'lit-html/static.js',
]);

/**
 * Where the scan of the template's static text stands, after the HTML
 * tokenizer: a quote opens only at the start of an attribute value, and a
 * comment or `<!`/`<?` construct is not a tag.
 */
type ScanMode =
  | 'text'
  | 'tag'
  | 'value'
  | 'unquoted'
  | 'quoted'
  | 'comment'
  | 'bogus';

interface TagScan {
  mode: ScanMode;
  isStatic: boolean;
  quote: string;
}

const TAG_OPEN = /^<\/?[a-zA-Z]/;

const closeTag = (scan: TagScan): void => {
  scan.mode = 'text';
  scan.isStatic = false;
};

/** Each step reads at `index` and returns how far to advance. */
const STEP: Record<
  ScanMode,
  (scan: TagScan, raw: string, index: number) => number
> = {
  text(scan, raw, index) {
    // Two, not four: `<!-->` and `<!--->` close at once, as the tokenizer has it.
    if (raw.startsWith('<!--', index)) {
      scan.mode = 'comment';

      return 2;
    }

    if (/^<[!?]/.test(raw.slice(index, index + 2))) scan.mode = 'bogus';
    else if (TAG_OPEN.test(raw.slice(index, index + 3))) scan.mode = 'tag';

    return 1;
  },
  tag(scan, raw, index) {
    if (raw[index] === '=') scan.mode = 'value';
    else if (raw[index] === '>') closeTag(scan);

    return 1;
  },
  value(scan, raw, index) {
    const char = raw[index] ?? '';

    if (char === '"' || char === "'") {
      scan.mode = 'quoted';
      scan.quote = char;
    } else if (char === '>') {
      closeTag(scan);
    } else if (!/\s/.test(char)) {
      scan.mode = 'unquoted';
    }

    return 1;
  },
  unquoted(scan, raw, index) {
    if (raw[index] === '>') closeTag(scan);
    else if (/\s/.test(raw[index] ?? '')) scan.mode = 'tag';

    return 1;
  },
  quoted(scan, raw, index) {
    if (raw[index] === scan.quote) scan.mode = 'tag';

    return 1;
  },
  comment(scan, raw, index) {
    if (!raw.startsWith('-->', index)) return 1;
    scan.mode = 'text';

    return 3;
  },
  bogus(scan, raw, index) {
    if (raw[index] === '>') scan.mode = 'text';

    return 1;
  },
};

const scanQuasi = (scan: TagScan, raw: string): void => {
  for (let index = 0; index < raw.length;) {
    index += STEP[scan.mode](scan, raw, index);
  }

  // An expression right after `=` is the whole unquoted value.
  if (scan.mode === 'value') scan.mode = 'unquoted';
};

/**
 * Expression indexes inside an opening or closing tag whose name is itself an
 * expression (`<${tag} ...>`, from `lit/static-html.js`). The analyzer parses
 * that tag as text, so it can't say where these expressions land. The tag-name
 * expression itself stays judged: a directive there is never a static value.
 */
const staticTagExpressions = (
  quasis: readonly { value: { raw: string } }[],
): Set<number> => {
  const hidden = new Set<number>();
  const scan: TagScan = { mode: 'text', isStatic: false, quote: '' };

  quasis.slice(0, -1).forEach(({ value: { raw } }, index) => {
    scanQuasi(scan, raw);

    if (scan.mode === 'text' && /<\/?$/.test(raw)) {
      scan.mode = 'tag';
      scan.isStatic = true;
    } else if (scan.isStatic) {
      hidden.add(index);
    }
  });

  return hidden;
};

/**
 * Every lit-ui-router directive only where its part type allows.
 *
 * Only expressions of a lit template are considered: a call held in a variable
 * says nothing about where it lands, and guessing there would be false
 * positives, not coverage.
 */
const directivePosition: RuleFor<typeof RULE_NAME> = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'require each lit-ui-router directive to sit in the template position its part type allows',
    },
    messages: {
      elementPartOnly:
        '`{{name}}` must be used as an element part (`<a ${{{name}}(...)}>`); it throws in attribute or child position.',
      attributePartOnly:
        '`{{name}}` must be used as an attribute part (`attr=${{{name}}(...)}`); it throws as an element part and in child position.',
      soleAttributeExpression:
        '`{{name}}` must be the only expression in its attribute; it throws when the attribute value is interpolated around it.',
      classAttributeOnly:
        '`{{name}}` must be bound in the `class` attribute (`class=${{{name}}(...)}`); it throws in any other attribute.',
    },
    schema: [],
  },

  create(context) {
    const tracker = createDirectiveTracker(context);

    return {
      ImportDeclaration(node) {
        tracker.onImport(node);
      },

      TaggedTemplateExpression(node) {
        if (!tracker.shouldAnalyse) return;

        if (!tracker.isLitTemplate(asNode(node.tag))) return;

        const expressions = asNodes(node.quasi.expressions);
        const analyzer = TemplateAnalyzer.create(node);

        const hidden = importedAs(context, asNode(node.tag), 'html', (source) =>
          STATIC_HTML_SOURCES.has(source),
        )
          ? staticTagExpressions(node.quasi.quasis)
          : new Set<number>();

        // Every expression index the parsed template resolved to an element
        // part; anything else is an attribute, child or comment position.
        const elementParts = new Set<number>();
        const attributeParts = new Map<number, AttributePart>();
        analyzer.traverse({
          enterElement(element) {
            if (element.sourceCodeLocation === undefined) return;

            for (const attribute of Object.keys(element.attribs)) {
              const index = elementPartIndex(attribute);

              if (index !== undefined) elementParts.add(index);
            }

            for (const [index, part] of attributePartsOf(element)) {
              attributeParts.set(index, part);
            }
          },
        });

        expressions.forEach((expression, index) => {
          const name = tracker.directiveOf(expression);

          if (name === undefined || hidden.has(index)) return;

          const report = (
            messageId:
              | 'elementPartOnly'
              | 'attributePartOnly'
              | 'soleAttributeExpression'
              | 'classAttributeOnly',
          ): void => {
            context.report({ node: expression, messageId, data: { name } });
          };

          if (ALLOWED_POSITION[name] === 'element') {
            if (!elementParts.has(index)) report('elementPartOnly');

            return;
          }

          const part = attributeParts.get(index);

          if (part === undefined) {
            report('attributePartOnly');

            return;
          }

          const attribute = ALLOWED_ATTRIBUTE[name];

          if (attribute !== undefined && part.name !== attribute) {
            report('classAttributeOnly');

            return;
          }

          if (WHOLE_VALUE[name] === true ? !part.whole : !part.only) {
            report('soleAttributeExpression');
          }
        });
      },
    };
  },
};

export { directivePosition };
