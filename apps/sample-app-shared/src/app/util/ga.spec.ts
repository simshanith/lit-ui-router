import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  memoryLocationPlugin,
  servicesPlugin,
  Transition,
  UIRouter,
  type HookMatchCriteria,
} from '@uirouter/core';
import googleAnalyticsHook from './ga.js';
import { featureFlags } from './featureDetection.js';
import routeFocusHook, { APP_TITLE } from '../global/routeFocus.hook.js';

const originalHref = window.location.href;

// the tester iframe URL carries params vitest needs, so add to it rather than replace it
const setLocationPlugin = (value: string) => {
  const url = new URL(window.location.href);
  url.searchParams.set('feature-location-plugin', value);
  history.replaceState(null, '', url);
};

/**
 * A stand-in for the Navigation API: an EventTarget carrying the one method
 * `canUseNavigationAPI()` probes. Stubbed rather than driven for real so the
 * lane assertions run on every engine, not only the ones shipping the API.
 */
class NavigationStub extends EventTarget {
  navigate() {}

  emit(navigationType: string) {
    this.dispatchEvent(
      Object.assign(new Event('navigate'), { navigationType }),
    );
  }
}

/** The shape of a transition the hook's `path()` reads. */
const fakeTransition = {
  to: () => ({}),
  $to: () => ({ url: { format: () => 'users' } }),
  params: () => ({}),
};

/** The params ga.js sends with a page_view. */
interface PageView {
  page_location: string;
  page_title: string;
}

/** Captures the onSuccess callback the hook registers, to fire per navigation. */
function fakeTransitionService() {
  let onSuccess: (trans: typeof fakeTransition) => void = () => {};

  const service = {
    onSuccess: (
      _criteria: HookMatchCriteria,
      callback: (trans: typeof fakeTransition) => void,
    ) => {
      onSuccess = callback;
    },
    onError: () => {},
  };

  return { service, success: () => onSuccess(fakeTransition) };
}

describe('googleAnalyticsHook page_view', () => {
  let navigation: NavigationStub;
  let pageViews: PageView[];

  beforeEach(() => {
    featureFlags.resetAll();
    sessionStorage.clear();
    navigation = new NavigationStub();
    vi.stubGlobal('navigation', navigation);
    pageViews = [];
    vi.stubGlobal('gtag', (command: string, name: string, params: PageView) => {
      if (command === 'event' && name === 'page_view') pageViews.push(params);
    });
    // the hook traces every page_view decision to console.debug
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    history.replaceState(null, '', originalHref);
    featureFlags.resetAll();
    sessionStorage.clear();
  });

  /** Installs the hook under `plugin` and returns a driver for one transition. */
  const install = (plugin: string) => {
    setLocationPlugin(plugin);
    const { service, success } = fakeTransitionService();
    googleAnalyticsHook(service);

    return (navigationType?: string) => {
      if (navigationType) navigation.emit(navigationType);
      success();
    };
  };

  describe('under the Navigation API', () => {
    it('sends a page_view gtag cannot see: push', () => {
      install('navigation')('push');
      expect(pageViews).toHaveLength(1);
    });

    it('sends a page_view gtag cannot see: replace', () => {
      install('navigation')('replace');
      expect(pageViews).toHaveLength(1);
    });

    it('stays silent on traverse — popstate fires and gtag counts it', () => {
      install('navigation')('traverse');
      expect(pageViews).toEqual([]);
    });

    it('stays silent on reload — the new document is gtag config page_view', () => {
      install('navigation')('reload');
      expect(pageViews).toEqual([]);
    });

    it('consumes the navigation kind, so a later transition cannot reuse it', () => {
      const transition = install('navigation');
      transition('push');
      transition(); // a transition with no navigate event of its own
      expect(pageViews).toHaveLength(1);
    });
  });

  describe('under the other location plugins', () => {
    it('sends nothing under pushState — gtag hooks history directly', () => {
      install('pushState')();
      expect(pageViews).toEqual([]);
      expect(console.debug).toHaveBeenCalledWith(
        'manual gtag page_view tracking skipped',
        expect.any(Object),
      );
    });

    it('sends every transition under hash — history is never touched', () => {
      const transition = install('hash');
      transition();
      transition();
      expect(pageViews).toHaveLength(2);
    });
  });
});

describe('googleAnalyticsHook page_title', () => {
  const SUBJECT = 'Secret subject';
  let router: UIRouter;
  let originalTitle: string;
  let gtagCalls: unknown[][];
  let pageTitle: string | undefined;
  let sentTitles: string[];

  beforeEach(() => {
    featureFlags.resetAll();
    originalTitle = document.title;
    gtagCalls = [];
    pageTitle = undefined;
    sentTitles = [];
    // `set` takes one params object; `event` takes a name, then params
    vi.stubGlobal(
      'gtag',
      (command: string, ...rest: [Partial<PageView>] | [string, PageView]) => {
        gtagCalls.push([command, ...rest]);

        if (rest.length === 1) {
          if (command === 'set') pageTitle = rest[0].page_title;

          return;
        }

        if (command === 'event' && rest[0] === 'page_view') {
          sentTitles.push(rest[1].page_title);
        }
      },
    );
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    router.dispose();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    history.replaceState(null, '', originalHref);
    document.title = originalTitle;
    featureFlags.resetAll();
  });

  /** The app's hooks on a real router, with a state titled by record content. */
  const install = (plugin: string) => {
    setLocationPlugin(plugin);
    router = new UIRouter();
    router.plugin(servicesPlugin);
    router.plugin(memoryLocationPlugin);
    routeFocusHook(router.transitionService);
    googleAnalyticsHook(router.transitionService);
    [
      { name: 'folder', url: '/inbox', data: { title: 'Inbox' } },
      {
        name: 'folder.message',
        url: '/:messageId',
        resolve: [{ token: 'subject', resolveFn: () => SUBJECT }],
        data: {
          title: (transition: Transition) =>
            String(transition.injector().get('subject')),
          analyticsTitle: 'Message',
        },
      },
    ].forEach((state) => router.stateRegistry.register(state));
  };

  it('keeps the record content in document.title', async () => {
    install('hash');
    await router.stateService.go('folder.message', { messageId: '1' });
    expect(document.title).toBe(`${SUBJECT} — ${APP_TITLE}`);
  });

  it('sends the static title with our page_views under hash', async () => {
    install('hash');
    await router.stateService.go('folder');
    await router.stateService.go('folder.message', { messageId: '1' });
    expect(sentTitles).toEqual([
      `Inbox — ${APP_TITLE}`,
      `Message — ${APP_TITLE}`,
    ]);
    expect(JSON.stringify(gtagCalls)).not.toContain(SUBJECT);
  });

  it("sets the static title before the url update gtag's history hook sees", async () => {
    install('pushState');
    const titlesAtPush: (string | undefined)[] = [];
    // stands in for gtag's pushState hook: the plugin writes the url here
    const { locationService } = router;
    const url = locationService.url.bind(locationService);
    vi.spyOn(locationService, 'url').mockImplementation((newUrl, replace) => {
      if (newUrl !== undefined) titlesAtPush.push(pageTitle);

      return url(newUrl, replace);
    });
    await router.stateService.go('folder');
    await router.stateService.go('folder.message', { messageId: '1' });
    expect(titlesAtPush).toEqual([
      `Inbox — ${APP_TITLE}`,
      `Message — ${APP_TITLE}`,
    ]);
    expect(JSON.stringify(gtagCalls)).not.toContain(SUBJECT);
  });
});
