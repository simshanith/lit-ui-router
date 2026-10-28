import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  memoryLocationPlugin,
  servicesPlugin,
  Transition,
  UIRouter,
} from '@uirouter/core';

import routeFocusHook, { APP_TITLE } from './routeFocus.hook.js';

/** Both sections stay in the DOM, as sticky views do; the inactive one hides. */
const fixture = `<main>
  <section data-section="messages">
    <h1 tabindex="-1">Messages</h1>
    <a href="#row" id="row">Row</a>
    <button id="send">Send</button>
  </section>
  <section data-section="contacts" hidden>
    <h1 tabindex="-1">Contacts</h1>
  </section>
</main>`;

const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('routeFocusHook', () => {
  let router: UIRouter;
  let originalTitle: string;

  beforeEach(async () => {
    originalTitle = document.title;
    document.body.innerHTML = fixture;
    router = new UIRouter();
    router.plugin(servicesPlugin);
    router.plugin(memoryLocationPlugin);
    // stands in for the ui-views: shows the destination's section
    router.transitionService.onSuccess(
      {},
      (transition) => {
        const section = transition.to().name?.split('.')[0];
        document.querySelectorAll('section').forEach((element) => {
          element.hidden = element.dataset.section !== section;
        });
      },
      { priority: 100 },
    );
    routeFocusHook(router.transitionService);
    [
      { name: 'messages', data: { title: 'Messages' } },
      {
        name: 'messages.folder',
        params: { folderId: 'inbox' },
        data: {
          title: (transition: Transition) =>
            String(transition.params().folderId),
        },
      },
      { name: 'messages.folder.message' },
      { name: 'contacts', data: { title: 'Contacts' } },
      { name: 'untitled' },
    ].forEach((state) => router.stateRegistry.register(state));
    await router.stateService.go('messages.folder');
    await settle();
  });

  afterEach(() => {
    router.dispose();
    document.body.innerHTML = '';
    document.title = originalTitle;
  });

  const focused = () => document.activeElement;

  it('titles the page from data.title, inherited by child states', async () => {
    expect(document.title).toBe(`inbox — ${APP_TITLE}`);
    await router.stateService.go('messages.folder.message');
    expect(document.title).toBe(`inbox — ${APP_TITLE}`);
    await router.stateService.go('contacts');
    expect(document.title).toBe(`Contacts — ${APP_TITLE}`);
    await router.stateService.go('untitled');
    expect(document.title).toBe(APP_TITLE);
  });

  it('leaves focus to the browser on the initial transition', () => {
    expect(focused()).toBe(document.body);
  });

  it('keeps focus on the activated link within a section', async () => {
    document.getElementById('row')!.focus();
    await router.stateService.go('messages.folder.message');
    await settle();
    expect(focused()?.id).toBe('row');
  });

  it("focuses the new section's visible heading", async () => {
    document.getElementById('row')!.focus();
    await router.stateService.go('contacts');
    await settle();
    expect(focused()?.textContent).toBe('Contacts');
  });

  it('focuses the heading when the focused control left the page', async () => {
    const send = document.getElementById('send')!;
    send.focus();
    await router.stateService.go('messages.folder.message');
    send.remove();
    await settle();
    expect(focused()?.textContent).toBe('Messages');
  });
});
