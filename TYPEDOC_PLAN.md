# TypeDoc API Documentation Plan

## Overview
This plan outlines the strategy for generating API documentation using TypeDoc for the lit-ui-router project, addressing issues #91 and #92.

## Current State Analysis

### Existing Documentation Structure
- **Location**: `docs/api/index.md`
- **Format**: Manually maintained markdown
- **Coverage**: Comprehensive user-facing documentation including:
  - Installation and imports
  - Core classes (UIRouterLit)
  - Components (`<ui-router>`, `<ui-view>`)
  - Directives (uiSref, uiSrefActive)
  - State declarations (LitStateDeclaration)
  - Component props (UIViewInjectedProps)
  - Lifecycle hooks (uiCanExit, uiOnParamsChanged)

### Source Code Documentation Status

#### Well-Documented Areas
1. **ui-router.ts**:
   - Good JSDoc on the `<ui-router>` component
   - Documents slots, events, and properties
   - Example: `@summary`, `@slot`, `@event` tags

2. **ui-view.ts**:
   - Good JSDoc on the `<ui-view>` component
   - Documents events and purpose
   - Internal methods marked with `@internal`

3. **interface.ts**:
   - Excellent documentation for lifecycle hooks
   - UiOnParamsChanged and UiOnExit interfaces well-documented
   - Detailed explanations of when hooks are called

#### Sparsely Documented Areas
1. **core.ts**:
   - UIRouterLit class: No JSDoc comments
   - LitViewConfig: Minimal documentation
   - litViewsBuilder: Has some JSDoc but could be enhanced
   - Critical internal functions lack documentation

2. **ui-sref.ts**:
   - UiSrefDirective class: No JSDoc
   - Public methods undocumented
   - Directive behavior not explained

3. **ui-sref-active.ts**:
   - UiSrefActiveDirective class: Minimal documentation
   - SrefStatus interface documented but directive itself lacks docs
   - Complex state tracking logic undocumented

## Comparison: Markdown Docs vs Source Comments

### Coverage Gaps

| API Element | Markdown Docs | Source Comments | Gap |
|------------|---------------|-----------------|-----|
| UIRouterLit class | ✓ High-level usage | ✗ Missing | Need class-level JSDoc |
| UIRouterLit.start() | ✓ Documented | ✗ Missing | Need method JSDoc |
| UIRouterLit.plugin() | ✓ Documented | ✗ Missing | Need method JSDoc |
| `<ui-router>` component | ✓ Documented | ✓ Good JSDoc | Well aligned |
| `<ui-view>` component | ✓ Documented | ✓ Good JSDoc | Well aligned |
| uiSref directive | ✓ Documented | ✗ Missing | Need directive JSDoc |
| uiSrefActive directive | ✓ Documented | Partial | Need enhancement |
| LitStateDeclaration | ✓ Documented | ✗ Missing | Need interface JSDoc |
| UIViewInjectedProps | ✓ Documented | Partial | Need enhancement |
| Lifecycle hooks | ✓ Documented | ✓ Excellent | Well aligned |

### Documentation Inconsistencies
1. **Markdown provides usage examples** - Source lacks example JSDoc tags
2. **Markdown has method tables** - Source methods lack JSDoc
3. **Markdown documents options** - Source parameter JSDoc incomplete

## Tricky Areas for TypeDoc Generation

### 1. **Lit Directives (uiSref, uiSrefActive)**
**Challenge**: TypeDoc doesn't naturally understand Lit directive patterns
- Directives extend `AsyncDirective` from lit/async-directive
- The `directive()` wrapper function obscures the actual class
- Documentation should focus on usage, not implementation

**Solution Strategy**:
- Add comprehensive JSDoc to directive classes
- Use `@example` tags to show usage patterns
- Consider custom TypeDoc plugin or manual documentation overlay
- Use `@public` tags to control visibility

### 2. **Custom Element Registration**
**Challenge**: `@customElement` decorators auto-register elements
- `<ui-router>` and `<ui-view>` are registered via decorators
- TypeDoc may not capture web component metadata properly

**Solution Strategy**:
- Ensure JSDoc includes HTML usage examples
- Document element name, attributes, and properties separately
- Cross-reference with Custom Elements Manifest (already generated)
- Use `@customelement` or custom tags

### 3. **Internal APIs**
**Challenge**: Many items marked `@internal` but still exported
- LitViewConfig, viewConfigFactory, litViewsBuilder, etc.
- Should be hidden from public API docs but visible for advanced users

**Solution Strategy**:
- Use TypeDoc's `--excludeInternal` flag
- Maintain `@internal` tags consistently
- Consider separate "Advanced API" documentation section
- Document what users should/shouldn't use

### 4. **Type Exports from @uirouter/core**
**Challenge**: Heavy reliance on types from external package
- Transition, StateObject, ViewConfig, etc.
- TypeDoc may try to document these external types

**Solution Strategy**:
- Use `--excludeExternals` flag
- Add links to @uirouter/core documentation
- Re-export types with additional JSDoc if needed
- Configure `typedoc.json` to handle external packages

### 5. **Template Functions and Function Overloads**
**Challenge**: Component can be a class OR a function
```typescript
component: RoutedLitTemplate | RoutedLitElement
```

**Solution Strategy**:
- Document both patterns with `@example` tags
- Use TypeDoc's union type rendering
- Explain when to use each pattern
- Consider separate documentation for each approach

### 6. **Event-Driven Architecture**
**Challenge**: Components communicate via CustomEvents
- ui-router-context event
- ui-view-context event
- uiSrefTarget event
- Complex event bubbling patterns

**Solution Strategy**:
- Document events with `@event` tags
- Include event detail types
- Explain event flow and bubbling
- Add sequence diagrams if possible

### 7. **State Machine Concepts**
**Challenge**: Requires understanding of UI-Router core concepts
- States, transitions, resolves, hooks
- Not obvious from type signatures alone

**Solution Strategy**:
- Add conceptual overview in main package JSDoc
- Link to UI-Router core documentation
- Include "Getting Started" in generated docs
- Use `@see` tags for cross-references

### 8. **Generic Types and Type Parameters**
**Challenge**: UIViewInjectedProps is generic
```typescript
UIViewInjectedProps<T = Record<string, any>>
```

**Solution Strategy**:
- Document type parameters with `@template` tag
- Provide concrete examples
- Explain common use cases
- Show before/after typing examples

## Implementation Plan

### Phase 1: Add JSDoc Comments (Priority: High)
**Goal**: Enhance source code documentation

#### Core Module (core.ts)
- [ ] Add class-level JSDoc to `UIRouterLit`
  - Explain it extends UIRouter from @uirouter/core
  - Document constructor behavior
  - Link to getting started guide
- [ ] Document `start()` method
  - Explain when to call it
  - Document thrown errors
  - Add usage example
- [ ] Add JSDoc to `LitViewConfig` (mark as @internal)
- [ ] Document `litViewsBuilder` function
  - Explain its role in state building
  - Mark as @internal but explain for advanced users

#### Directives (ui-sref.ts, ui-sref-active.ts)
- [ ] Add class-level JSDoc to `UiSrefDirective`
  - Focus on user-facing usage via `uiSref()`
  - Include multiple `@example` tags
  - Document parameters
- [ ] Add class-level JSDoc to `UiSrefActiveDirective`
  - Focus on user-facing usage via `uiSrefActive()`
  - Explain active vs exact classes
  - Include examples
- [ ] Document key public interfaces
  - SrefStatus
  - UiSrefActiveParams

#### Interfaces (interface.ts)
- [ ] Add JSDoc to `LitStateDeclaration`
  - Explain relationship to StateDeclaration
  - Document the component property
  - Add state registration examples
- [ ] Enhance `UIViewInjectedProps` documentation
  - Add `@template` documentation
  - Provide typed examples
  - Explain each property's use case
- [ ] Add examples to `RoutedLitTemplate` and `RoutedLitElement`

### Phase 2: TypeDoc Configuration (Priority: High)
**Goal**: Set up TypeDoc tooling

- [ ] Install TypeDoc and plugins
  ```bash
  pnpm add -D typedoc typedoc-plugin-markdown
  ```
- [ ] Create `typedoc.json` configuration
  ```json
  {
    "$schema": "https://typedoc.org/schema.json",
    "entryPoints": ["packages/lit-ui-router/src/index.ts"],
    "out": "docs/api-generated",
    "plugin": ["typedoc-plugin-markdown"],
    "excludeExternals": true,
    "excludeInternal": true,
    "categorizeByGroup": true,
    "includeVersion": true,
    "readme": "packages/lit-ui-router/README.md",
    "navigationLinks": {
      "Home": "https://lit-ui-router.dev",
      "GitHub": "https://github.com/simshanith/lit-ui-router"
    }
  }
  ```
- [ ] Add npm script to package.json
  ```json
  "docs:api": "typedoc"
  ```
- [ ] Test generation locally

### Phase 3: Documentation Enhancement (Priority: Medium)
**Goal**: Improve generated documentation quality

- [ ] Add package-level documentation
  - Create module documentation in index.ts
  - Add overview and getting started
  - Include architectural notes
- [ ] Organize with @category tags
  - Core (UIRouterLit)
  - Components (ui-router, ui-view)
  - Directives (uiSref, uiSrefActive)
  - Types (interfaces and type aliases)
  - Hooks (lifecycle interfaces)
- [ ] Add code examples throughout
  - Use `@example` tags liberally
  - Include both TypeScript and JavaScript examples
  - Show common patterns and use cases
- [ ] Link to external resources
  - @uirouter/core documentation
  - Lit documentation
  - Tutorial pages

### Phase 4: Integration & Automation (Priority: Medium)
**Goal**: Integrate TypeDoc into build process

- [ ] Add TypeDoc to CI/CD pipeline
  - Generate docs on PR builds
  - Deploy to docs site on merge to main
- [ ] Update turbo.json for monorepo support
- [ ] Consider versioned documentation
  - Generate docs per release
  - Archive old versions
- [ ] Add doc linting/validation
  - Check for missing JSDoc
  - Validate examples compile
  - Ensure no broken links

### Phase 5: Migration Strategy (Priority: Low)
**Goal**: Transition from manual to generated docs

**Option A: Hybrid Approach** (Recommended)
- Keep existing docs/api/index.md as "API Guide"
- Generate TypeDoc to docs/api-reference/
- Update index.md to link to generated reference
- Maintain both: guide (manual) + reference (generated)

**Option B: Full Migration**
- Replace docs/api/index.md with TypeDoc output
- Requires extensive JSDoc to match current content
- Higher risk, more work upfront

**Option C: Side-by-side**
- Generate TypeDoc to separate location
- Gradually improve JSDoc quality
- Eventually deprecate manual docs

### Phase 6: Maintenance & Guidelines (Priority: Low)
**Goal**: Ensure ongoing documentation quality

- [ ] Create CONTRIBUTING.md section on documentation
- [ ] Establish JSDoc standards
  - Required tags for public APIs
  - Example requirements
  - Style guide
- [ ] Set up pre-commit hooks
  - Lint JSDoc comments
  - Validate TypeDoc generation succeeds
- [ ] Regular audits
  - Review generated docs quarterly
  - Update examples for new Lit versions
  - Ensure external links valid

## Technical Considerations

### TypeDoc Limitations
1. **Custom Lit decorators**: May need plugin or manual intervention
2. **Directive patterns**: Not standard class patterns, needs special handling
3. **Web Components**: TypeDoc doesn't understand custom element semantics natively
4. **Generic constraints**: Complex generics may render poorly

### Alternative/Complementary Tools
- **Custom Elements Manifest**: Already in use, generates custom-elements.json
- **web-component-analyzer**: Alternative to CEM
- **API Extractor**: Microsoft tool, more focused on TypeScript libraries
- **Docusaurus**: Could host generated TypeDoc output
- **Storybook**: For component documentation with live examples

### Integration with Existing Tools
- **Custom Elements Manifest** (already generating)
  - Keep this for web component metadata
  - Use TypeDoc for TypeScript API reference
  - Cross-reference between them
- **Prettier**: Ensure JSDoc formatted consistently
- **ESLint**: Add JSDoc linting rules
- **Vitest**: Document testing utilities with JSDoc

## Success Criteria

### Must Have
- [ ] All public APIs have JSDoc comments
- [ ] TypeDoc generates without errors
- [ ] Generated docs deployed to website
- [ ] Documentation matches or exceeds current manual docs

### Should Have
- [ ] Examples for all major APIs
- [ ] Internal APIs appropriately hidden/documented
- [ ] Clear navigation and categorization
- [ ] Links to tutorials and guides

### Nice to Have
- [ ] Automated doc generation in CI
- [ ] Version-specific documentation
- [ ] Interactive examples (via StackBlitz)
- [ ] API diff between versions

## Risk Assessment

### High Risk
- **Breaking existing documentation workflow**: Mitigation: Phased rollout
- **TypeDoc not handling Lit patterns well**: Mitigation: Test early, consider hybrid approach

### Medium Risk
- **Maintenance burden increases**: Mitigation: Automation and guidelines
- **Generated docs less readable than manual**: Mitigation: Extensive JSDoc enhancement

### Low Risk
- **Tool compatibility issues**: Mitigation: Pin versions, test thoroughly
- **Performance impact on builds**: Mitigation: Separate doc generation step

## Next Steps

1. **Immediate**: Review this plan with maintainers, discuss issues #91 & #92
2. **Week 1**: Start Phase 1 - Add JSDoc to core.ts and interface.ts
3. **Week 2**: Complete Phase 1 and begin Phase 2 - Set up TypeDoc
4. **Week 3**: Test generation, review output quality, iterate
5. **Week 4**: Choose migration strategy, implement Phase 3
6. **Ongoing**: Phases 4-6 based on timeline and priorities

## Questions to Resolve

1. What specific issues are #91 and #92 addressing? (Unable to access GitHub issues)
2. Preference for hybrid vs. full migration approach?
3. Should TypeDoc output live in `/docs` or separate location?
4. Deploy generated docs to lit-ui-router.dev or separate subdomain?
5. Version-specific docs needed immediately or future enhancement?
6. Budget for custom TypeDoc plugins if needed for Lit-specific features?
7. Should we document internal APIs separately for advanced users?

## Resources

- [TypeDoc Documentation](https://typedoc.org/)
- [TypeDoc JSDoc Tags](https://typedoc.org/guides/tags/)
- [Lit Documentation Best Practices](https://lit.dev/docs/tools/documentation/)
- [@custom-elements-manifest/analyzer](https://custom-elements-manifest.open-wc.org/)
- [UI-Router Core Docs](https://ui-router.github.io/core/)
