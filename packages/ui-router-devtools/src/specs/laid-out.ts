import type { UIRouterDevtools } from '../ui-router-devtools.ts';

/**
 * Settles once the panel has laid the Map or the Views out for their area's current size.
 * The panel learns that size from a ResizeObserver, which reports only at the engine's next rendering update,
 * so this observes the same area and waits for that update instead of polling for what it draws.
 */
export const laidOut = async (element: UIRouterDevtools): Promise<void> => {
  await element.updateComplete;

  const area = element.renderRoot.querySelector('.map-scroll, .vm-main');

  if (!area) return;

  // The panel's observer predates this one, so it reports first; the spec resumes in a later task, outside the delivery.
  await new Promise<void>((resolve) => {
    const observer = new ResizeObserver(() => {
      observer.disconnect();
      setTimeout(resolve);
    });

    observer.observe(area);
  });

  while (!(await element.updateComplete));
};
