/**
 * FILL THE WINDOW — the app's copy of generator/chrome.mjs's FILL_SCRIPT, one
 * delegated click for every `.fill` button a fragment carries. Fullscreen when
 * the browser grants it, the `is-filled` overlay when it does not; the figure
 * hears `atlas-fill` either way, so a canvas or a graph can refit.
 */
const filled = (): Element | null => document.querySelector('.fillable.is-filled');

const tell = (box: Element): void => {
  box.dispatchEvent(new CustomEvent('atlas-fill', { bubbles: true }));
  window.dispatchEvent(new Event('resize'));
};

const leave = (): void => {
  const box = filled();
  if (!box) return;
  box.classList.remove('is-filled');
  document.documentElement.classList.remove('has-filled');
  tell(box);
};

const onClick = (event: MouseEvent): void => {
  const button = event.target instanceof Element ? event.target.closest('.fill') : null;
  const box = button?.closest('.fillable');
  if (!box) return;
  if (document.fullscreenElement === box) {
    void document.exitFullscreen();
    return;
  }
  if (box.classList.contains('is-filled')) {
    leave();
    return;
  }
  const ask =
    typeof box.requestFullscreen === 'function'
      ? box.requestFullscreen()
      : Promise.reject(new Error('fullscreen is not available'));
  ask.catch(() => {
    box.classList.add('is-filled');
    document.documentElement.classList.add('has-filled');
    tell(box);
  });
};

export function installFill(): void {
  document.addEventListener('click', onClick);
  document.addEventListener('fullscreenchange', () => {
    const box = document.fullscreenElement;
    tell(box?.classList.contains('fillable') ? box : document.body);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filled()) leave();
  });
}
