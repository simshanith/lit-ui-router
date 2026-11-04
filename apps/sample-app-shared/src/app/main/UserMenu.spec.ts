import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';

import { UserMenu } from './UserMenu.js';

async function mount() {
  const outside = document.createElement('button');
  outside.textContent = 'Elsewhere';
  const menu = new UserMenu();
  menu.emailAddress = 'user@example.com';
  document.body.append(menu, outside);
  await menu.updateComplete;

  const toggle = page.getByRole('button', { name: 'user@example.com' });
  await userEvent.click(toggle);

  return { menu, toggle, outside };
}

const expanded = () =>
  document.querySelector('.disclosure-toggle')?.getAttribute('aria-expanded');

describe('sample-user-menu disclosure', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('opens on the toggle', async () => {
    await mount();

    expect(expanded()).toBe('true');
  });

  it('closes on Escape and returns focus to the toggle', async () => {
    const { menu, toggle } = await mount();

    await userEvent.keyboard('{Tab}');
    await userEvent.keyboard('{Escape}');
    await menu.updateComplete;

    expect(expanded()).toBe('false');
    await expect.element(toggle).toHaveFocus();
  });

  it('stays open while focus moves inside it', async () => {
    const { menu } = await mount();

    await userEvent.keyboard('{Tab}');
    await menu.updateComplete;

    expect(expanded()).toBe('true');
    await expect
      .element(page.getByRole('button', { name: 'Log Out' }))
      .toHaveFocus();
  });

  it('closes when focus leaves it', async () => {
    const { menu, outside } = await mount();

    outside.focus();
    await menu.updateComplete;

    expect(expanded()).toBe('false');
  });
});
