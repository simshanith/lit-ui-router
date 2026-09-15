// The round trip both client lanes run: draw a document on the server, serve it into a live container, boot a client into it.
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { expect } from 'vitest';
import type { RenderInfo } from '@lit-labs/ssr';
import type { TemplateResult } from 'lit';
import { withRouterSync } from 'lit-ui-router/context';
import type { UIRouterLit } from 'lit-ui-router/pure';
import { hydrateRoot, wakeAll } from '../client.js';
import { goTo, makeRouter } from './fixture.js';

/** A page template, drawn by the server and re-rendered by the client. */
export type Page = (router: UIRouterLit) => TemplateResult;

/** The document a build would have emitted for `path`. */
export const draw = async (
  page: Page,
  renderers: RenderInfo['elementRenderers'],
  path: string,
): Promise<string> => {
  const router = makeRouter();
  await goTo(router, path);
  return withRouterSync(router, () =>
    collectResultSync(render(page(router), { elementRenderers: renderers })),
  );
};

// happy-dom parses `<template shadowrootmode>` as a plain template, where a browser's parser would attach a shadow root; lit's own hydrate support arms on `shadowRoot` being there.
const attachShadowRoots = (root: ParentNode): void => {
  for (const template of [
    ...root.querySelectorAll('template[shadowrootmode]'),
  ]) {
    const host = template.parentElement;
    if (!host) continue;
    const mode = template.getAttribute('shadowrootmode') as ShadowRootMode;
    const shadow = host.attachShadow({ mode });
    shadow.append((template as HTMLTemplateElement).content);
    template.remove();
    attachShadowRoots(shadow);
  }
};

/** Parses `markup` into a live container and stamps every element it holds. */
export const serve = (
  markup: string,
): { container: HTMLElement; served: Element[] } => {
  const container = document.createElement('div');
  document.body.append(container);
  container.innerHTML = markup;
  attachShadowRoots(container);
  const served = [...container.querySelectorAll('*')];
  for (const [index, element] of served.entries()) {
    element.setAttribute('data-served', String(index));
  }
  return { container, served };
};

/** Hydrates `container` and settles a fresh client router on `path`, stopping short of the wake. */
export const bootInto = async (
  container: HTMLElement,
  page: Page,
  path: string,
): Promise<UIRouterLit> => {
  const router = makeRouter();
  expect(hydrateRoot(container, page(router))).toBe(true);
  const booted = new Promise<void>((resolve) => {
    const off = router.transitionService.onSuccess({}, () => {
      off();
      resolve();
    }) as () => void;
  });
  router.urlService.url(path);
  router.start();
  await booted;
  return router;
};

/** The whole trip: {@link bootInto}, then the ordered wake. */
export const boot = async (
  container: HTMLElement,
  page: Page,
  path: string,
): Promise<UIRouterLit> => {
  const router = await bootInto(container, page, path);
  wakeAll(container);
  return router;
};
