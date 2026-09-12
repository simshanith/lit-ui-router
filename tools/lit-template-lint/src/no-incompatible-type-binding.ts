// Mirrors lit-analyzer 2.0.3's `lib/rules/no-incompatible-type-binding.js`
// (MIT, runem), extended so lit's `nothing` in an attribute binding's type is
// not a type error: lit removes the attribute rather than assigning it.
import {
  LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER,
  LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER,
  LIT_HTML_PROP_ATTRIBUTE_MODIFIER,
} from 'lit-analyzer';
import { HtmlNodeAttrAssignmentKind } from 'lit-analyzer/lib/analyze/types/html-node/html-node-attr-assignment-types.js';
import type { RuleModule } from 'lit-analyzer/lib/analyze/types/rule/rule-module.js';
import { extractBindingTypes } from 'lit-analyzer/lib/rules/util/type/extract-binding-types.js';
import { isAssignableInAttributeBinding } from 'lit-analyzer/lib/rules/util/type/is-assignable-in-attribute-binding.js';
import { isAssignableInBooleanBinding } from 'lit-analyzer/lib/rules/util/type/is-assignable-in-boolean-binding.js';
import { isAssignableInElementBinding } from 'lit-analyzer/lib/rules/util/type/is-assignable-in-element-binding.js';
import { isAssignableInPropertyBinding } from 'lit-analyzer/lib/rules/util/type/is-assignable-in-property-binding.js';

import { withoutNothing } from './without-nothing.ts';

export const noIncompatibleTypeBinding: RuleModule = {
  id: 'no-incompatible-type-binding',
  meta: { priority: 'low' },
  visitHtmlAssignment(assignment, context) {
    const htmlAttr = assignment.htmlAttr;
    if (assignment.kind === HtmlNodeAttrAssignmentKind.ELEMENT_EXPRESSION) {
      const { typeB } = extractBindingTypes(assignment, context);
      isAssignableInElementBinding(htmlAttr, typeB, context);
    }
    if (context.htmlStore.getHtmlAttrTarget(htmlAttr) == null) return;
    const { typeA, typeB } = extractBindingTypes(assignment, context);
    switch (htmlAttr.modifier) {
      // Stock below: lit hands `nothing` to a property as undefined, and the
      // boolean and element paths have semantics of their own.
      case LIT_HTML_BOOLEAN_ATTRIBUTE_MODIFIER:
        isAssignableInBooleanBinding(htmlAttr, { typeA, typeB }, context);
        break;
      case LIT_HTML_PROP_ATTRIBUTE_MODIFIER:
        isAssignableInPropertyBinding(htmlAttr, { typeA, typeB }, context);
        break;
      case LIT_HTML_EVENT_LISTENER_ATTRIBUTE_MODIFIER:
        break;
      default: {
        const bound = withoutNothing(typeB);
        // undefined: only `nothing` reaches the attribute, so it is removed.
        if (bound != null) {
          isAssignableInAttributeBinding(
            htmlAttr,
            { typeA, typeB: bound },
            context,
          );
        }
        break;
      }
    }
  },
};
