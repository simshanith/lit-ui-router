# TypeDoc API Documentation Plan

**Issues**: #91, #92
**Goal**: Generate API docs from source comments using TypeDoc (literate programming)

## Issue Summary

- **#91**: Link to @uirouter/core API reference where possible (interim improvement)
- **#92**: Generate API docs from source comments instead of maintaining separate markdown

## Current State

### Existing Manual Docs (`docs/api/index.md`)
- 317 lines of comprehensive markdown
- Covers: UIRouterLit, components, directives, state declarations, lifecycle hooks
- Well-structured with examples and tables

### Source Code JSDoc Coverage

| File | Status | Notes |
|------|--------|-------|
| `interface.ts` | ✅ Excellent | Lifecycle hooks well-documented |
| `ui-router.ts` | ✅ Good | Component has @summary, @slot, @event |
| `ui-view.ts` | ✅ Good | Component documented, @internal used |
| `core.ts` | ❌ Missing | UIRouterLit class has no JSDoc |
| `ui-sref.ts` | ❌ Missing | Directive class undocumented |
| `ui-sref-active.ts` | ⚠️ Partial | SrefStatus documented, directive not |

## Tricky Areas

1. **Lit Directives** - `directive()` wrapper obscures the class; need careful JSDoc placement
2. **Custom Elements** - TypeDoc doesn't understand `@customElement` decorator natively
3. **Internal APIs** - Many `@internal` items exported; use `--excludeInternal`
4. **External Types** - Heavy use of @uirouter/core types; need `--excludeExternals` + links
5. **Union Types** - `component: RoutedLitTemplate | RoutedLitElement` needs clear examples

## Implementation Plan

### Phase 1: Add Missing JSDoc (Priority: High)

**Files to modify:**

#### `packages/lit-ui-router/src/core.ts`
```typescript
/**
 * The main router class for Lit applications.
 * Extends {@link https://ui-router.github.io/core/docs/latest/classes/_router_.uirouter.html | UIRouter} from @uirouter/core.
 *
 * @example
 * ```ts
 * import { UIRouterLit } from 'lit-ui-router';
 * import { hashLocationPlugin } from '@uirouter/core';
 *
 * const router = new UIRouterLit();
 * router.plugin(hashLocationPlugin);
 * router.stateRegistry.register({ name: 'home', url: '/home', component: HomeComponent });
 * router.start();
 * ```
 *
 * @see {@link https://ui-router.github.io/core/docs/latest/ | UI-Router Core Documentation}
 */
export class UIRouterLit extends UIRouter { ... }
```

- Add JSDoc to `UIRouterLit` class
- Document `start()` method with @throws
- Mark `LitViewConfig`, `litViewsBuilder` as `@internal`

#### `packages/lit-ui-router/src/ui-sref.ts`
- Add class-level JSDoc to `UiSrefDirective`
- Document the exported `uiSref` directive with @example tags
- Add @param docs for state, params, options

#### `packages/lit-ui-router/src/ui-sref-active.ts`
- Add class-level JSDoc to `UiSrefActiveDirective`
- Enhance `SrefStatus` interface documentation
- Document `uiSrefActive` with @example

#### `packages/lit-ui-router/src/interface.ts`
- Add JSDoc to `LitStateDeclaration`
- Add @template tag to `UIViewInjectedProps`
- Document type aliases with @example

### Phase 2: TypeDoc Setup + Custom Plugin (Priority: High)

**Reference**: [typedoc-plugin-ui-router](https://github.com/christopherthielen/typedoc-plugin-ui-router) - existing plugin for @uirouter/core

**New files to create:**

#### `packages/typedoc-plugin-lit-ui-router/` (new package)

Create a custom TypeDoc plugin to handle Lit-specific patterns:

```typescript
// packages/typedoc-plugin-lit-ui-router/src/index.ts
import { Application, Converter, ReflectionKind } from 'typedoc';

export function load(app: Application) {
  // 1. Handle Lit directives - document the directive() wrapper result
  app.converter.on(Converter.EVENT_RESOLVE_END, (context) => {
    // Find directive exports (uiSref, uiSrefActive)
    // Link to underlying class documentation
  });

  // 2. Add @uirouter/core cross-links
  app.converter.on(Converter.EVENT_RESOLVE, (context, reflection) => {
    // Add @see links to external UI-Router core types
  });

  // 3. Custom navigation structure
  // Group: Core | Components | Directives | Types | Hooks
}
```

**Plugin responsibilities:**
- Rename/organize modules for cleaner navigation
- Add `@see` links to @uirouter/core API docs (addresses #91)
- Handle `directive()` wrapper pattern for better directive docs
- Optionally integrate Custom Elements Manifest data

#### `packages/typedoc-plugin-lit-ui-router/package.json`
```json
{
  "name": "typedoc-plugin-lit-ui-router",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc"
  },
  "peerDependencies": {
    "typedoc": "^0.27.0"
  },
  "devDependencies": {
    "typedoc": "^0.27.0",
    "typescript": "5.8.3"
  }
}
```

#### `packages/lit-ui-router/typedoc.json`
```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["src/index.ts"],
  "out": "../../docs/api/reference",
  "plugin": [
    "typedoc-plugin-markdown",
    "typedoc-plugin-lit-ui-router"
  ],
  "excludeExternals": true,
  "excludeInternal": true,
  "excludePrivate": true,
  "categorizeByGroup": true,
  "categoryOrder": ["Core", "Components", "Directives", "Types", "Hooks"],
  "readme": "none",
  "githubPages": false
}
```

**Modifications:**

#### `packages/lit-ui-router/package.json`
Add scripts:
```json
"docs": "typedoc",
"docs:watch": "typedoc --watch"
```

Add devDependencies:
```json
"typedoc": "^0.27.x",
"typedoc-plugin-markdown": "^4.x"
```

### Phase 3: Add @uirouter/core Links (Addresses #91)

Add `@see` tags linking to ui-router core docs throughout:
- `HookResult` → https://ui-router.github.io/core/docs/latest/modules/_transition_interface_.html#hookresult
- `Transition` → https://ui-router.github.io/core/docs/latest/classes/_transition_transition_.transition.html
- `StateDeclaration` → https://ui-router.github.io/core/docs/latest/interfaces/_state_interface_.statedeclaration.html

### Phase 4: Integration with VitePress

**Current docs setup:**
- VitePress at `docs/` with dev server via `pnpm docs`
- Build via `vitepress build .`
- Turbo `docs` task is persistent (dev server)

#### `packages/lit-ui-router/package.json`
Add TypeDoc script:
```json
"docs:api": "typedoc"
```

#### `docs/package.json`
Add script to run TypeDoc and format generated output:
```json
"docs:api": "pnpm --filter lit-ui-router docs:api && prettier --write api/reference/**/*.md"
```

#### `docs/turbo.json`
Add task configuration (local to docs package):
```json
{
  "$schema": "https://turborepo.com/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": {
      "dependsOn": ["docs:api"]
    },
    "docs:api": {
      "dependsOn": ["lit-ui-router#build", "typedoc-plugin-lit-ui-router#build"],
      "outputs": ["api/reference/**"],
      "inputs": [
        "../packages/lit-ui-router/src/**/*.ts",
        "../packages/lit-ui-router/typedoc.json",
        "../.prettierrc"
      ]
    },
    "e2e": {
      "interruptible": true
    }
  }
}
```

*Note: `build` depends on `docs:api` so TypeDoc generates before VitePress builds. This runs automatically during Cloudflare deployment.*

#### `docs/.vitepress/config.ts`
Update sidebar to include generated API reference (nested under `/api/`):
```typescript
sidebar: [
  {
    text: 'Tutorial',
    items: [...]
  },
  {
    text: 'API',
    items: [
      { text: 'Guide', link: '/api/' },
      { text: 'Reference', link: '/api/reference/' }  // <-- add (generated TypeDoc)
    ],
  },
],
```

#### `docs/api/index.md`
- Keep as "API Guide" with usage examples
- Add link to generated API reference at top
- Cross-reference between guide and reference

#### CI/CD Integration
- **GitHub workflows**: No changes needed - `turbo ci` doesn't include docs build
- **Cloudflare deployment**: No changes needed - `docs#build` now depends on `docs:api`
- TypeDoc generates automatically when `pnpm turbo docs#build` runs

## Files to Modify

| File | Action |
|------|--------|
| `packages/lit-ui-router/src/core.ts` | Add JSDoc |
| `packages/lit-ui-router/src/ui-sref.ts` | Add JSDoc |
| `packages/lit-ui-router/src/ui-sref-active.ts` | Add JSDoc |
| `packages/lit-ui-router/src/interface.ts` | Enhance JSDoc |
| `packages/lit-ui-router/package.json` | Add typedoc deps/scripts |
| `packages/lit-ui-router/typedoc.json` | Create config |
| `packages/typedoc-plugin-lit-ui-router/` | Create plugin package (new) |
| `packages/typedoc-plugin-lit-ui-router/src/index.ts` | Plugin implementation |
| `packages/typedoc-plugin-lit-ui-router/package.json` | Plugin package config |
| `docs/api/index.md` | Add link to generated docs |
| `docs/.vitepress/config.ts` | Add API Reference to sidebar |
| `docs/package.json` | Add `docs:api` script |
| `docs/turbo.json` | Add `docs:api` task + build dependency |

*Note: `pnpm-workspace.yaml` already includes `packages/*`, so no changes needed there.*

## Git Commit Strategy

Make a git commit after each todo step that edits files:

| Step | Commit Message |
|------|---------------|
| Plugin package structure | `feat(typedoc-plugin): create package structure` |
| TypeDoc deps | `build(lit-ui-router): add typedoc dependencies` |
| typedoc.json | `build(lit-ui-router): add typedoc configuration` |
| JSDoc core.ts | `docs(lit-ui-router): add JSDoc to UIRouterLit class` |
| JSDoc ui-sref.ts | `docs(lit-ui-router): add JSDoc to UiSrefDirective` |
| JSDoc ui-sref-active.ts | `docs(lit-ui-router): add JSDoc to UiSrefActiveDirective` |
| JSDoc interface.ts | `docs(lit-ui-router): enhance JSDoc in interface.ts` |
| Plugin implementation | `feat(typedoc-plugin): implement TypeDoc plugin` |
| docs/package.json | `build(docs): add docs:api script` |
| docs/turbo.json | `build(docs): add docs:api task configuration` |
| VitePress sidebar | `feat(docs): add API Reference to sidebar` |
| docs/api/index.md | `docs: link to generated API reference` |

## Verification

1. Build the TypeDoc plugin:
   ```bash
   cd packages/typedoc-plugin-lit-ui-router
   pnpm build
   ```

2. Format and lint source files:
   ```bash
   pnpm turbo format        # Apply formatting fixes
   pnpm turbo format:check  # Verify formatting (CI)
   pnpm turbo lint          # Run ESLint
   ```

3. Run TypeDoc generation (from docs package):
   ```bash
   cd docs && pnpm docs:api
   ```

4. Verify output in `docs/api/reference/`:
   - Check all public APIs are documented
   - Verify internal APIs are excluded
   - Confirm @uirouter/core links work

5. Run VitePress dev server and verify:
   ```bash
   cd docs && pnpm docs
   ```
   - Navigate to API Reference in sidebar
   - Verify generated markdown renders correctly
   - Check navigation between API Guide and API Reference

6. Build full docs site:
   ```bash
   cd docs && pnpm build
   ```
   - Preview with `pnpm docs:preview`
   - Verify all links work

## Confirmed Decisions

- **Output location**: `docs/api/reference/` (nested under existing `/api/` path)
- **Migration approach**: Hybrid - keep manual guide + generated reference
- **CI/CD**: Integrated via turbo task dependencies (no workflow changes needed)
- **Plugin scope**: Internal workspace package only (not published to npm)
