<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';

defineProps<{ src: string; title: string }>();

const emit = defineEmits<{ hash: [hash: string] }>();

const frame = useTemplateRef('frame');

// The tallest content seen at the frame's current width; it never shrinks at one width, so the pager holds still between cards.
const fitted = ref<{ width: number; height: number }>();

// Keyed by document: a frame's WindowProxy outlives a reload, its listeners do not.
const watched = new WeakSet<Document>();

let sized: ResizeObserver | undefined;

function fit(body: HTMLElement) {
  const element = frame.value;

  if (!element) return;

  const { marginTop, marginBottom } = getComputedStyle(body);

  const height = Math.ceil(
    body.getBoundingClientRect().height +
      Number.parseFloat(marginTop) +
      Number.parseFloat(marginBottom),
  );

  const width = element.clientWidth;

  const last = fitted.value;

  if (!last || last.width !== width || height > last.height)
    fitted.value = { width, height };
}

// The frame is same-origin and the example routes by hash, so its location and layout are readable here.
function follow() {
  try {
    const view = frame.value?.contentWindow;

    if (!view || view.location.origin !== location.origin) return;

    const read = () => emit('hash', view.location.hash);

    read();

    if (watched.has(view.document)) return;
    watched.add(view.document);
    view.addEventListener('hashchange', read);

    const { body } = view.document;

    // SAFETY: a same-origin frame's window is typed as this one's is, Window & typeof globalThis.
    const { ResizeObserver: FrameResizeObserver } = view as Window &
      typeof globalThis;

    const observer = new FrameResizeObserver(() => fit(body));

    observer.observe(body);
    sized?.disconnect();
    sized = observer;
  } catch {
    // An unreadable frame: the diagram keeps the state it last showed, the frame its reserved height.
  }
}

// A frame that loaded before hydration fired its load event unheard.
onMounted(follow);

onBeforeUnmount(() => sized?.disconnect());
</script>

<template>
  <iframe
    ref="frame"
    class="tour-frame"
    :src="src"
    :title="title"
    :style="fitted ? { blockSize: `${fitted.height}px` } : undefined"
    loading="lazy"
    @load="follow"
  />
</template>

<style scoped>
.tour-frame {
  display: block;
  inline-size: 100%;
  block-size: var(--tour-frame-height, auto);
  border: 0;
  border-radius: var(--site-radius-control);
  /* Shows only until the example paints. */
  background: var(--site-color-surface);
}
</style>
