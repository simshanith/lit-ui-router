import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { page } from 'vitest/browser';
// The app loads the shared stylesheet via src/main.ts; the dialog design the
// spec asserts (backdrop dim, overlay, centering, card width) lives entirely
// in styles.css — it flattens Bootstrap's modal skin under the aliased class
// names, so the CDN Bootstrap link is not needed to reproduce these rules.
import '../../styles.css';
import dialogService from './dialogService.js';

const settleAnimations = (el: Element) =>
  Promise.all(el.getAnimations().map((animation) => animation.finished));

describe('confirmation dialog', () => {
  beforeEach(async () => {
    // the width/centering assertions came from Cypress's default viewport
    await page.viewport(1000, 660);
  });

  afterEach(() => {
    // a failed assertion can leave the dialog mounted; open() prepends it
    if (dialogService.component.isConnected) {
      dialogService.component.removeDialog();
    }
  });

  it('renders the shared sample-app dialog design', async () => {
    const closed = dialogService.confirm('Delete contact: Rios Sears');
    // dismissal rejects; assert it below without an unhandled rejection
    closed.catch(() => {});

    const dialog = document.querySelector('.dialog .content');
    expect(dialog).not.toBeNull();
    expect(dialog?.textContent).toContain('Delete contact: Rios Sears');
    expect(dialog?.textContent).toContain('Are you sure?');

    // white card horizontally centered over a dimmed backdrop
    const modal = document.querySelector('.dialog#modal');
    expect(modal?.classList.contains('in')).toBe(true);

    // dimmed backdrop (entrance animates opacity, so let it settle first)
    const backdrop = document.querySelector('.dialog .backdrop');
    expect(backdrop?.classList.contains('in')).toBe(true);
    if (!backdrop) throw new Error('backdrop not rendered');
    await settleAnimations(backdrop);
    expect(getComputedStyle(backdrop).opacity).toBe('0.5');

    const content = document.querySelector('.dialog .content');
    if (!content) throw new Error('dialog content not rendered');
    await settleAnimations(content);
    const rect = content.getBoundingClientRect();
    // Measure against the document's client width to account for scrollbar.
    const layoutWidth = content.ownerDocument.documentElement.clientWidth;
    const viewportCenter = layoutWidth / 2;
    const cardCenter = rect.left + rect.width / 2;
    expect(Math.abs(cardCenter - viewportCenter)).toBeLessThanOrEqual(2);
    expect(rect.width).toBeLessThan(layoutWidth / 2);

    const denyButton = [
      ...document.querySelectorAll<HTMLButtonElement>('.dialog button'),
    ].find((button) => button.textContent?.includes('No'));
    if (!denyButton) throw new Error('deny button not rendered');
    denyButton.click();

    await expect(closed).rejects.toBe(false);
    expect(document.querySelector('#backdrop')).toBeNull();
  });
});
