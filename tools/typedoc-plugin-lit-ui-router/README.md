# typedoc-plugin-lit-ui-router

Auto-converts `[[SymbolName]]` JSDoc links to `{@link url | SymbolName}` for external documentation.

## Usage

In JSDoc comments, use the `[[SymbolName]]` shorthand syntax:

```typescript
/**
 * See [[Transition]] for details.
 * Access [[StateDeclaration.component]] property.
 */
```

The plugin automatically converts these to proper TypeDoc links:

```typescript
/**
 * See {@link https://ui-router.github.io/core/docs/latest/classes/_transition_transition_.transition.html | Transition} for details.
 * Access {@link https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html#component | StateDeclaration.component} property.
 */
```

## Supported Symbols

### UI-Router Core

**Classes:**

- `UIRouter`, `StateService`, `StateRegistry`, `StateObject`, `TargetState`
- `TransitionService`, `Transition`, `UrlService`, `UrlConfig`, `UrlRules`
- `Trace`, `UrlMatcher`, `Resolvable`, `PathNode`, `Param`, `Rejection`

**Interfaces:**

- `StateDeclaration`, `HrefOptions`, `LazyLoadResult`, `TransitionPromise`
- `IHookRegistry`, `HookMatchCriteria`, `TransitionHookFn`, `TransitionStateHookFn`
- `TransitionOptions`, `TreeChanges`, `RawParams`, `ParamDeclaration`, `ViewConfig`

**Type Aliases:**

- `HookResult`, `HookFn`, `StateOrName`, `ResolveTypes`

**Enums:**

- `TransitionHookPhase`, `TransitionHookScope`, `RejectType`

### Lit

**Directives:**

- `AsyncDirective`, `Directive`, `Part`, `ChildPart`, `ElementPart`
- `AttributePart`, `PropertyPart`, `EventPart`

**Types:**

- `LitElement`, `TemplateResult`, `PartInfo`, `PartType`
- `ReactiveController`, `PropertyDeclaration`

**Values:**

- `noChange`, `directive`

## Custom Symbols

Add custom symbol mappings in your `typedoc.json`:

```json
{
  "externalSymbolLinkMappings": {
    "CustomType": {
      "": "https://example.com/docs/customtype.html"
    }
  }
}
```

## Unknown Symbols

Symbols not in the predefined map or custom mappings are logged as warnings and linked to local anchors:

```bash
[typedoc-plugin-lit-ui-router] Unknown symbol: [[MyCustomType]]
```

This generates: `{@link #mycustomtype | MyCustomType}`

## URL Templates

| Type       | Template                          |
| ---------- | --------------------------------- |
| Class      | `/classes/{module}{name}.html`    |
| Interface  | `/interfaces/{module}{name}.html` |
| Type/Alias | `/modules/{module}.html#anchor`   |
| Enum       | `/enums/{module}{name}.html`      |

## Symbol File Structure

```
src/symbols/
├── index.ts      # Combined exports
├── ui-router.ts  # UI-Router Core symbols (templated)
└── lit.ts        # Lit symbols (templated)
```

### Adding New Symbols

To add a new symbol, use the template functions:

```typescript
// ui-router.ts
import { interfaceTemplate, classTemplate, typeTemplate } from './templates.js';

// Add a new interface
...interfaceTemplate('NewInterface', '_module_'),

// Add a new class
...classTemplate('NewClass', '_module_'),

// Add a new type alias
...typeTemplate('NewType', '_module_', 'anchor'),
```

## Plugin Events

- `Converter.EVENT_RESOLVE_BEGIN`: Processes JSDoc comments and converts `[[SymbolName]]` patterns
- `Converter.EVENT_RESOLVE_END`: Handles directive wrapper patterns
- `Converter.EVENT_RESOLVE`: Adds category tags for organization

## Category Tags

The plugin automatically adds `@category` tags to reflections:

- `Core`: UIRouterLit
- `Components`: UIRouterElement, UIViewElement
- `Directives`: uiSref, uiSrefActive
- `Hooks`: UiOnExit, UiOnParamsChanged
- `Types`: LitStateDeclaration, UIViewInjectedProps, etc.
