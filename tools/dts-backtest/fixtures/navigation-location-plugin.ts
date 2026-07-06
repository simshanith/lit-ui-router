import { UIRouter } from '@uirouter/core';
import {
  isUIRouterNavigateEvent,
  navigationLocationPlugin,
  type NavigationLocationService,
  type UIRouterNavigateEvent,
  type UIRouterNavigateInfo,
} from 'ui-router-navigation-location-plugin';

export function setupNavigation(router: UIRouter): NavigationLocationService {
  router.plugin(navigationLocationPlugin);
  const { service } = navigationLocationPlugin(router);

  window.navigation.addEventListener('navigate', (event: NavigateEvent) => {
    if (isUIRouterNavigateEvent(event)) {
      const navigateEvent: UIRouterNavigateEvent = event;
      const info: UIRouterNavigateInfo = navigateEvent.info;
      void info.uiRouter.stateService;
    }
  });

  return service as NavigationLocationService;
}
