import { hashLocationPlugin, trace, Category, Rejection } from '@uirouter/core';
import { StickyStatesPlugin } from '@uirouter/sticky-states';
import { DSRPlugin } from '@uirouter/dsr';

import { UIRouterLit, LitStateDeclaration } from 'lit-ui-router';

import appStates from './app/main/states.js';
import reqAuthHook from './app/global/requiresAuth.hook.js';
import googleAnalyticsHook from './app/util/ga.js';

export const HOME = 'home';
export const NESTED_HOME = 'home.nested';
export const UNLISTED_NESTED_HOME = 'home.unlisted';

export function configureRouter(router = new UIRouterLit()) {
  router.plugin(hashLocationPlugin);
  import('@uirouter/visualizer').then(({ Visualizer }) =>
    router.plugin(Visualizer),
  );
  router.plugin(DSRPlugin);
  router.plugin(StickyStatesPlugin);

  const { stateService, stateRegistry, urlService } = router;

  stateService.defaultErrorHandler(($error$) => {
    if ($error$ instanceof Error && $error$.stack) {
      console.error($error$);
      console.error($error$.stack);
    } else if ($error$ instanceof Rejection) {
      // custom downgrade to warning
      console.warn($error$.toString());
      if ($error$.detail && $error$.detail.stack)
        console.warn($error$.detail.stack);
    } else {
      console.error($error$);
    }
  });

  appStates.forEach((state) =>
    stateRegistry.register(state as LitStateDeclaration),
  );

  urlService.rules.initial({ state: 'welcome' });

  // Register the "requires auth" hook with the TransitionsService
  router.transitionService.onBefore(
    reqAuthHook.criteria,
    reqAuthHook.callback,
    { priority: 10 },
  );
  googleAnalyticsHook(router.transitionService);

  router.start();
  return router;
}

if (import.meta.env.VITE_TRACE === 'true') {
  trace.enable(Category.TRANSITION, Category.VIEWCONFIG, Category.UIVIEW);
}
