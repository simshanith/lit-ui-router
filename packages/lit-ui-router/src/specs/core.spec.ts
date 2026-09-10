import { describe, it, expect, beforeEach } from 'vitest';
import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StateObject, PathNode } from '@uirouter/core';

import {
  UIRouterLit,
  LitViewConfig,
  isLitViewDeclarationTemplate,
  isRoutedLitElement,
} from '../core.js';
import { createTestRouter } from './test-utils.js';
import {
  UIViewInjectedProps,
  LitStateDeclaration,
  LitViewDeclaration,
  NormalizedLitViewDeclaration,
  RoutedLitTemplate,
} from '../interface.js';

@customElement('test-element-guard-1')
class TestElementGuard extends LitElement {}

@customElement('test-element-routed-1')
class TestElementRouted extends LitElement {}

@customElement('test-element-argless-1')
class TestElementArgless extends LitElement {}

@customElement('test-routed-element')
class TestRoutedElement extends LitElement {
  render() {
    return html`<div>Routed Element</div>`;
  }
}

@customElement('test-element-sticky-1')
class TestElementSticky extends LitElement {
  static sticky = true;
}

declare global {
  interface HTMLElementTagNameMap {
    'test-element-guard-1': TestElementGuard;
    'test-element-routed-1': TestElementRouted;
    'test-element-argless-1': TestElementArgless;
    'test-routed-element': TestRoutedElement;
    'test-element-sticky-1': TestElementSticky;
  }
}

describe('UIRouterLit', () => {
  let router: UIRouterLit;

  beforeEach(() => {
    router = createTestRouter();
  });

  describe('initialization', () => {
    it('should create a new router instance', () => {
      expect(router).toBeInstanceOf(UIRouterLit);
    });

    it('should have stateService available', () => {
      expect(router.stateService).toBeDefined();
    });

    it('should have stateRegistry available', () => {
      expect(router.stateRegistry).toBeDefined();
    });

    it('should have transitionService available', () => {
      expect(router.transitionService).toBeDefined();
    });

    it('should have viewService available', () => {
      expect(router.viewService).toBeDefined();
    });

    it('should have urlService available', () => {
      expect(router.urlService).toBeDefined();
    });
  });

  describe('start()', () => {
    it('should start the router', () => {
      expect(() => router.start()).not.toThrow();
    });

    it('should throw if called multiple times', () => {
      router.start();
      expect(() => router.start()).toThrow('start() called multiple times');
    });
  });

  describe('state registration', () => {
    it('should register a state', () => {
      router.stateRegistry.register({
        name: 'home',
        url: '/home',
      });

      const state = router.stateRegistry.get('home');
      expect(state).toBeDefined();
      expect(state?.name).toBe('home');
    });

    it('should register multiple states', () => {
      router.stateRegistry.register({ name: 'home', url: '/home' });
      router.stateRegistry.register({ name: 'about', url: '/about' });

      expect(router.stateRegistry.get('home')).toBeDefined();
      expect(router.stateRegistry.get('about')).toBeDefined();
    });

    it('should register nested states', () => {
      router.stateRegistry.register({ name: 'parent', url: '/parent' });
      router.stateRegistry.register({
        name: 'parent.child',
        url: '/child',
      });

      const childState = router.stateRegistry.get('parent.child');
      expect(childState).toBeDefined();
      expect(childState?.name).toBe('parent.child');
    });
  });

  describe('state navigation', () => {
    beforeEach(() => {
      router.stateRegistry.register({ name: 'home', url: '/home' });
      router.stateRegistry.register({ name: 'about', url: '/about' });
      router.start();
    });

    it('should navigate to a state', async () => {
      await router.stateService.go('home');
      expect(router.globals.current.name).toBe('home');
    });

    it('should navigate between states', async () => {
      await router.stateService.go('home');
      expect(router.globals.current.name).toBe('home');

      await router.stateService.go('about');
      expect(router.globals.current.name).toBe('about');
    });

    it('should navigate with parameters', async () => {
      router.stateRegistry.register({
        name: 'user',
        url: '/user/:id',
      });

      await router.stateService.go('user', { id: '123' });
      expect(router.globals.current.name).toBe('user');
      expect(router.globals.params.id).toBe('123');
    });
  });
});

describe('LitViewConfig', () => {
  it('should create a view config with incrementing id', () => {
    const path: PathNode[] = [];
    const viewDecl = { $type: 'lit' };

    const config1 = new LitViewConfig(path, viewDecl);
    const config2 = new LitViewConfig(path, viewDecl);

    expect(config1.$id).toBeDefined();
    expect(config2.$id).toBeDefined();
    expect(config2.$id).toBeGreaterThan(config1.$id);
  });

  it('should be marked as loaded', () => {
    const config = new LitViewConfig([], {});
    expect(config.loaded).toBe(true);
  });

  it('should resolve load() immediately', async () => {
    const config = new LitViewConfig([], {});
    const result = await config.load();
    expect(result).toBe(config);
  });

  it('should store path and viewDecl', () => {
    const path: PathNode[] = [];
    const viewDecl = { $type: 'lit', component: () => html`` };

    const config = new LitViewConfig(path, viewDecl);

    expect(config.path).toBe(path);
    expect(config.viewDecl).toBe(viewDecl);
  });
});

describe('isLitViewDeclarationTemplate', () => {
  it('should return true for function templates', () => {
    const template = () => html`<div>test</div>`;
    expect(isLitViewDeclarationTemplate(template)).toBe(true);
  });

  it('should return true for arrow functions with props', () => {
    const template = (_props: UIViewInjectedProps) => html`<div>test</div>`;
    expect(isLitViewDeclarationTemplate(template)).toBe(true);
  });

  it('should return false for objects', () => {
    const obj = { component: () => html`<div>test</div>` };
    expect(isLitViewDeclarationTemplate(obj)).toBe(false);
  });

  it('should return true for LitElement classes with argless constructors', () => {
    expect(isLitViewDeclarationTemplate(TestElementGuard)).toBe(true);
  });
});

describe('isRoutedLitElement', () => {
  it('should return true for LitElement subclass', () => {
    expect(isRoutedLitElement(TestElementRouted)).toBe(true);
  });

  it('should return false for regular functions', () => {
    const fn = () => html`<div>test</div>`;
    expect(isRoutedLitElement(fn)).toBe(false);
  });

  it('should return false for plain objects', () => {
    expect(isRoutedLitElement({})).toBe(false);
  });

  it('should return false for null', () => {
    expect(isRoutedLitElement(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isRoutedLitElement(undefined)).toBe(false);
  });

  it('should return false for HTMLElement (non-Lit)', () => {
    class PlainElement extends HTMLElement {}
    expect(isRoutedLitElement(PlainElement)).toBe(false);
  });
});

describe('litViewsBuilder', () => {
  let router: UIRouterLit;

  beforeEach(() => {
    router = createTestRouter();
  });

  it('should create default view from component property', async () => {
    const component = () => html`<div>test</div>`;
    const stateDecl: LitStateDeclaration = {
      name: 'test',
      url: '/test',
      component,
    };

    let $$state: StateObject | undefined;
    await new Promise((resolve) => {
      const offStatesChanged = router.stateRegistry.onStatesChanged(
        (event, states) => {
          switch (event) {
            case 'registered':
              offStatesChanged();
              resolve(states);
              break;
            default:
              break;
          }
        },
      );

      $$state = router.stateRegistry.register(stateDecl);
    });
    const state = router.stateRegistry.get('test');
    expect($$state).toBeDefined();
    expect($$state).toBe(state.$$state?.());
    expect($$state?.views).toBeDefined();
    expect($$state?.views?.$default).toBeDefined();
  });

  it('should normalize template function to component object', async () => {
    const component = () => html`<div>test</div>`;
    const stateDecl: LitStateDeclaration = {
      name: 'test',
      url: '/test',
      views: {
        $default: component,
      },
    };

    await new Promise((resolve) => {
      const offStatesChanged = router.stateRegistry.onStatesChanged(
        (event, states) => {
          switch (event) {
            case 'registered':
              offStatesChanged();
              resolve(states);
              break;
            default:
              break;
          }
        },
      );

      router.stateRegistry.register(stateDecl);
    });
    const state = router.stateRegistry.get('test');

    expect(state?.views?.$default).toBeDefined();
    expect(state?.views?.$default.$type).toBe('lit');
  });

  it('should set $context on view declaration', async () => {
    const stateDecl: LitStateDeclaration = {
      name: 'test',
      url: '/test',
      component: () => html`<div>test</div>`,
    };

    await new Promise((resolve) => {
      const offStatesChanged = router.stateRegistry.onStatesChanged(
        (event, states) => {
          switch (event) {
            case 'registered':
              offStatesChanged();
              resolve(states);
              break;
            default:
              break;
          }
        },
      );

      router.stateRegistry.register(stateDecl);
    });
    const state = router.stateRegistry.get('test').$$state?.();
    expect(state?.views?.$default).toBeDefined();
    expect(state?.views?.$default.$context).toBeDefined();
  });

  it('should set $name on view declaration', async () => {
    const stateDecl: LitStateDeclaration = {
      name: 'test',
      url: '/test',
      component: () => html`<div>test</div>`,
    };

    await new Promise((resolve) => {
      const offStatesChanged = router.stateRegistry.onStatesChanged(
        (event, states) => {
          switch (event) {
            case 'registered':
              offStatesChanged();
              resolve(states);
              break;
            default:
              break;
          }
        },
      );

      router.stateRegistry.register(stateDecl);
    });
    const state = router.stateRegistry.get('test').$$state?.();
    expect(state?.views?.$default.$name).toBe('$default');
  });

  it('should handle named views', async () => {
    const stateDecl: LitStateDeclaration = {
      name: 'test',
      url: '/test',
      views: {
        header: { component: () => html`<header>Header</header>` },
        content: { component: () => html`<main>Content</main>` },
      },
    };

    await new Promise((resolve) => {
      const offStatesChanged = router.stateRegistry.onStatesChanged(
        (event, states) => {
          switch (event) {
            case 'registered':
              offStatesChanged();
              resolve(states);
              break;
            default:
              break;
          }
        },
      );

      router.stateRegistry.register(stateDecl);
    });
    const state = router.stateRegistry.get('test');

    expect(state?.views?.header).toBeDefined();
    expect(state?.views?.content).toBeDefined();
    expect(state?.views?.header.$name).toBe('header');
    expect(state?.views?.content.$name).toBe('content');
  });

  it('should skip empty view configs', async () => {
    const stateDecl: LitStateDeclaration = {
      name: 'test',
      url: '/test',
      views: {
        // runtime skips empty view configs; LitViewDeclaration requires a component
        empty: {} as LitViewDeclaration,
      },
    };

    const state = router.stateRegistry.get('test');
    await new Promise((resolve) => {
      const offStatesChanged = router.stateRegistry.onStatesChanged(
        (event, states) => {
          switch (event) {
            case 'registered':
              offStatesChanged();
              resolve(states);
              break;
            default:
              break;
          }
        },
      );

      router.stateRegistry.register(stateDecl);
    });

    expect(state?.views?.empty).toBeUndefined();
  });

  it('should leave a non-sticky LitElement class on the declaration', async () => {
    const stateDecl: LitStateDeclaration = {
      name: 'test',
      url: '/test',
      component: TestRoutedElement,
    };

    await new Promise((resolve) => {
      const offStatesChanged = router.stateRegistry.onStatesChanged(
        (event, states) => {
          switch (event) {
            case 'registered':
              offStatesChanged();
              resolve(states);
              break;
            default:
              break;
          }
        },
      );

      router.stateRegistry.register(stateDecl);
    });
    const state = router.stateRegistry.get('test').$$state?.();
    // litViewsBuilder normalizes views; core's StateObject.views typing cannot express it
    const views = state?.views as
      | Record<string, NormalizedLitViewDeclaration>
      | undefined;

    // The class is preserved verbatim: `<ui-view>` owns instance identity and
    // only mints a new element when the view config changes (#723).
    expect(views?.$default.component).toBe(TestRoutedElement);
  });

  it('should wrap a sticky LitElement class in a declaration-scoped closure', () => {
    const stateDecl: LitStateDeclaration = {
      name: 'sticky',
      url: '/sticky',
      component: TestElementSticky,
    };

    router.stateRegistry.register(stateDecl);

    const state = router.stateRegistry.get('sticky').$$state?.();
    // litViewsBuilder normalizes views; core's StateObject.views typing cannot express it
    const views = state?.views as
      | Record<string, NormalizedLitViewDeclaration>
      | undefined;
    const component = views?.$default.component;

    // A sticky instance must outlive the `<ui-view>` elements that render it,
    // so it stays cached on the declaration rather than on the view.
    expect(component).not.toBe(TestElementSticky);
    expect(isRoutedLitElement(component)).toBe(false);

    const first = (component as RoutedLitTemplate)({} as UIViewInjectedProps);
    const props = {} as UIViewInjectedProps;
    const second = (component as RoutedLitTemplate)(props);
    const instance = second.values[0] as TestElementSticky & {
      _uiViewProps?: UIViewInjectedProps;
    };

    expect(instance).toBeInstanceOf(TestElementSticky);
    expect(first.values[0]).toBe(instance);
    expect(instance._uiViewProps).toBe(props);
  });

  it('should register a bare argless LitElement class and deliver props via property', async () => {
    const stateDecl: LitStateDeclaration = {
      name: 'argless',
      url: '/argless',
      views: {
        $default: TestElementArgless,
      },
    };

    await new Promise((resolve) => {
      const offStatesChanged = router.stateRegistry.onStatesChanged(
        (event, states) => {
          switch (event) {
            case 'registered':
              offStatesChanged();
              resolve(states);
              break;
            default:
              break;
          }
        },
      );

      router.stateRegistry.register(stateDecl);
    });
    const state = router.stateRegistry.get('argless').$$state?.();
    // litViewsBuilder normalizes views; core's StateObject.views typing cannot express it
    const views = state?.views as
      | Record<string, NormalizedLitViewDeclaration>
      | undefined;

    // Previously the guard rejected argless classes and the builder silently
    // dropped the view as an empty object config.
    expect(views?.$default).toBeDefined();
    expect(views?.$default.component).toBe(TestElementArgless);
    // Prop delivery for argless classes is asserted end-to-end in ui-view.spec.
  });
});

describe('typings regressions', () => {
  it('should recognize required-props templates as view declarations', () => {
    // Assignability half lives in ./typings-regressions.types.ts (typecheck).
    const template = (props: UIViewInjectedProps) =>
      html`<div>${props.transition?.from().name}</div>`;
    expect(isLitViewDeclarationTemplate(template)).toBe(true);
  });
});
