import { describe, expect, it } from 'vitest';
import {
  memoryLocationPlugin,
  servicesPlugin,
  UIRouter,
  type Transition,
  type ViewConfig,
} from '@uirouter/core';

import { resetRouter } from '../router-reset.ts';

const pageRouter = (): UIRouter => {
  const router = new UIRouter();
  router.plugin(servicesPlugin);
  router.plugin(memoryLocationPlugin);
  router.stateRegistry.register({
    name: 'page',
    url: '/page/:n',
    params: { n: { dynamic: true } },
    resolve: [
      {
        token: 'label',
        deps: ['$transition$'],
        resolveFn: (transition: Transition) => `page ${transition.params().n}`,
      },
    ],
  });

  return router;
};

const labelAfter = async (router: UIRouter, n: string): Promise<string> => {
  await router.stateService.go('page', { n });

  // SAFETY: the `label` resolve returns a string.
  return router.globals.successfulTransitions
    .peekTail()
    .injector()
    .get('label') as string;
};

describe('resetRouter', () => {
  it('leaves the globals a new router starts with', async () => {
    const router = pageRouter();
    await router.stateService.go('page', { n: '1' });

    resetRouter(router);

    const { globals } = router;
    expect(globals.successfulTransitions.size()).toBe(0);
    expect(globals.transitionHistory.size()).toBe(0);
    expect(globals.$current).toBe(router.stateRegistry.root());
    expect(globals.current).toBe(router.stateRegistry.root().self);
    expect(globals.params).toEqual({});
  });

  it('deactivates every view the router drew', () => {
    const router = pageRouter();
    const { viewService } = router;
    const root = router.stateRegistry.root();

    const config: ViewConfig = {
      $id: 1,
      path: [],
      loaded: true,
      viewDecl: {
        $context: root,
        $uiViewName: '$default',
        $uiViewContextAnchor: '',
      },
      load: () => Promise.resolve(config),
    };

    viewService.activateViewConfig(config);
    expect(viewService._pluginapi._activeViewConfigs()).toEqual([config]);

    resetRouter(router);

    expect(viewService._pluginapi._activeViewConfigs()).toEqual([]);
  });

  it('runs the resolves of a state a dynamic param change would retain', async () => {
    const router = pageRouter();
    await labelAfter(router, '1');

    expect(await labelAfter(router, '2')).toBe('page 1');

    resetRouter(router);

    expect(await labelAfter(router, '3')).toBe('page 3');
  });
});
