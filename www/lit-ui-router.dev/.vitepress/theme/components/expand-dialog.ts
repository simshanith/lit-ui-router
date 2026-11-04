import { ref, type Ref } from 'vue';

// Expand lifts the embed's own <dialog> into the top layer, so nothing is reparented; Escape and inertness are native.
export function useExpandDialog(
  dialog: Readonly<Ref<HTMLDialogElement | null>>,
) {
  const expanded = ref(false);

  let opener: HTMLElement | undefined;

  function toggle(event: Event) {
    const el = dialog.value;

    if (!el) return;

    if (el.open) {
      el.close();

      return;
    }

    opener =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget
        : undefined;
    el.showModal();
    // showModal() focuses the first focusable descendant; an iframe there would swallow Escape.
    opener?.focus();
    expanded.value = true;
  }

  // WebKit never focuses a clicked button, so native focus return lands on the dialog.
  function onClose() {
    expanded.value = false;
    opener?.focus();
  }

  return { expanded, toggle, onClose };
}
