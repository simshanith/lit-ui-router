import { ref, type Ref } from 'vue';

// Expand lifts the embed's own <dialog> into the top layer, so nothing is reparented; Escape, focus return and inertness are native.
export function useExpandDialog(
  dialog: Readonly<Ref<HTMLDialogElement | null>>,
) {
  const expanded = ref(false);

  function toggle() {
    const el = dialog.value;

    if (!el) return;

    if (el.open) {
      el.close();
    } else {
      el.showModal();
      expanded.value = true;
    }
  }

  function onClose() {
    expanded.value = false;
  }

  return { expanded, toggle, onClose };
}
