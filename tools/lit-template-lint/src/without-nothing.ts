// lit's `nothing` sentinel is `declare const nothing: unique symbol`, which
// ts-simple-type models as ES_SYMBOL_UNIQUE carrying TypeScript's escaped name
// (`__@nothing@<id>`) as its `value`. Stripping follows lit-analyzer 2.0.3's
// own `lib/rules/util/type/remove-undefined-from-type.js` idiom.
import type { extractBindingTypes } from 'lit-analyzer/lib/rules/util/type/extract-binding-types.js';

// The analyzer's own SimpleType, without a direct ts-simple-type dependency.
type BindingType = ReturnType<typeof extractBindingTypes>['typeB'];

const NOTHING_VALUE = /^__@nothing@\d+$/;

/** The type with lit's `nothing` removed, or undefined if only `nothing` was there. */
export function withoutNothing(type: BindingType): BindingType | undefined {
  if (type.kind === 'ALIAS') {
    const target = withoutNothing(type.target);
    return target == null ? undefined : { ...type, target };
  }
  if (type.kind === 'UNION') {
    const types = type.types
      .map(withoutNothing)
      .filter((member) => member != null);
    if (types.length === 0) return undefined;
    if (types.length === 1) return types[0];
    return { ...type, types };
  }
  const isNothing =
    type.kind === 'ES_SYMBOL_UNIQUE' && NOTHING_VALUE.test(type.value);
  return isNothing ? undefined : type;
}
