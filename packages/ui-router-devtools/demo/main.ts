import { UIRouter, hashLocationPlugin, servicesPlugin } from '@uirouter/core';
import { DevtoolsPlugin } from '../src/plugin.ts';
import { reportToPerformance } from '../src/performance.ts';
import { reportToConsole } from '../src/console.ts';
import { demoStates, delay } from './states.ts';
import { demoSequence, goByUrl, goQuietly } from './sequence.ts';
import { stressSequence, stressStates } from './stress.ts';

const query = new URLSearchParams(location.search);

const router = new UIRouter();

router.plugin(servicesPlugin);

router.plugin(hashLocationPlugin);

const devtools = router.plugin(DevtoolsPlugin, { timeResolves: true });

(query.has('stress') ? stressStates() : demoStates()).forEach((s) =>
  router.stateRegistry.register(s),
);

const recorder = devtools.element.recorder;

if (recorder && query.has('perf')) reportToPerformance(recorder);

if (recorder && query.has('console')) reportToConsole(recorder);

const view = document.querySelector<HTMLElement>('#view')!;

router.transitionService.onSuccess({}, (trans) => {
  const to = trans.to().name ?? '';
  const params = trans.params();
  const title = to === 'galaxy.stars.star' ? String(params.starId) : to;
  view.innerHTML = `<h2>${title}</h2><p>Stub view for <code>${to}</code>.</p>`;
});

const actions = {
  url: () => goByUrl(router, '/galaxy/astronaut'),
  replace: () =>
    goQuietly(
      router,
      'galaxy.stars.star',
      { starId: 'arcturus' },
      { location: 'replace' },
    ),
  reload: () =>
    goQuietly(
      router,
      router.globals.current.name ?? 'galaxy.stars',
      undefined,
      { reload: true },
    ),
  invalid: () => goQuietly(router, 'galaxy.planets'),
  demo: () => demoSequence(router),
};

const isAction = (name: string): name is keyof typeof actions =>
  Object.hasOwn(actions, name);

for (const button of document.querySelectorAll<HTMLButtonElement>(
  '[data-go], [data-action]',
)) {
  button.addEventListener('click', () => {
    const action = button.dataset.action;

    if (action) {
      if (isAction(action)) void actions[action]();

      return;
    }

    const [state, starId] = (button.dataset.go ?? '').split(':');
    void goQuietly(router, state, starId ? { starId } : undefined);
  });
}

if (query.has('stress')) {
  location.hash = '';
  router.urlService.listen();
  void stressSequence(router).then(
    () => (document.documentElement.dataset.demo = 'done'),
  );
} else if (query.has('demo')) {
  location.hash = '';
  router.urlService.rules.initial({
    state: 'galaxy.stars.star',
    params: { starId: 'sun' },
  });
  router.urlService.listen();
  router.urlService.sync();
  void delay(400, null)
    .then(() => demoSequence(router))
    .then(() => delay(50, null))
    .then(() => (document.documentElement.dataset.demo = 'done'));
} else {
  router.urlService.rules.initial({ state: 'galaxy.stars' });
  router.urlService.rules.otherwise({ state: 'galaxy.stars' });
  router.urlService.listen();
  router.urlService.sync();
}
