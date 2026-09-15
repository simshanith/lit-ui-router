// The round trip both client lanes run: draw a document on the server, serve it into a live container, boot a client into it.
import { render } from '@lit-labs/ssr';
import { collectResultSync } from '@lit-labs/ssr/lib/render-result.js';
import { expect } from 'vitest';
import type { RenderInfo } from '@lit-labs/ssr';
import type { TemplateResult } from 'lit';
import { withRouterSync } from 'lit-ui-router/context';
import type { UIRouterLit } from 'lit-ui-router/pure';
import { hydrateRoot } from '../client.js';
import { goTo, makeRouter } from './fixture.js';

/** A page template, drawn by the server and re-rendered by the client. */
export type Page = (router: UIRouterLit) => TemplateResult;

/** The document a build would have emitted for `path`, with `prerender()`'s own render options. */
export const draw = async (
  page: Page,
  renderers: RenderInfo['elementRenderers'],
  path: string,
): Promise<string> => {
  const router = makeRouter();
  await goTo(router, path);
  return withRouterSync(router, () =>
    collectResultSync(
      render(page(router), {
        elementRenderers: renderers,
        deferHydration: true,
      }),
    ),
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

const tick = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

/** Flushes the wakes the root walk starts: each level's update wakes the next. */
export const settle = async (container: HTMLElement): Promise<void> => {
  for (let pass = 0; pass < 10; pass += 1) {
    await tick();
    if (!container.querySelector('[defer-hydration]')) break;
  }
  await tick();
};

/** Every comment the walk reads, at any depth, so a spec can pin what is left. */
export const comments = (container: HTMLElement): string[] => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  const found: string[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    found.push((node as Comment).data);
  }
  return found;
};

/**
 * Drops every `lit-node` marker standing before a `<ui-view>`, leaving the wake
 * to nothing but the view's own slot part.
 *
 * @returns how many were dropped
 */
export const dropViewNodeMarkers = (container: HTMLElement): number => {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT);
  const doomed: Comment[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const comment = node as Comment;
    if (!/^(ui-view:)?lit-node \d+$/.test(comment.data)) continue;
    if (comment.nextElementSibling?.localName === 'ui-view') {
      doomed.push(comment);
    }
  }
  for (const comment of doomed) comment.remove();
  return doomed.length;
};

/**
 * The whole trip: settle a fresh client router on `path`, hydrate the served
 * container, and let every woken view finish.
 */
export const boot = async (
  container: HTMLElement,
  page: Page,
  path: string,
): Promise<UIRouterLit> => {
  const router = makeRouter();
  await goTo(router, path);
  expect(hydrateRoot(container, page(router))).toBe(true);
  await settle(container);
  return router;
};
