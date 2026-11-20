<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';

defineProps<{ src: string; title: string; height: string }>();

const emit = defineEmits<{ hash: [hash: string] }>();

const frame = useTemplateRef('frame');

// Keyed by document: a frame's WindowProxy outlives a reload, its listeners do not.
const watched = new WeakSet<Document>();

// The frame is same-origin and the example routes by hash, so its location is readable here.
function follow() {
  try {
    const view = frame.value?.contentWindow;

    if (!view || view.location.origin !== location.origin) return;

    const read = () => emit('hash', view.location.hash);

    read();

    if (watched.has(view.document)) return;
    watched.add(view.document);
    view.addEventListener('hashchange', read);
  } catch {
    // An unreadable frame: the diagram keeps the state it last showed.
  }
}

// A frame that loaded before hydration fired its load event unheard.
onMounted(follow);
</script>

<template>
  <iframe
    ref="frame"
    class="tour-frame"
    :src="src"
    :title="title"
    :style="{ '--tour-frame-height': height }"
    loading="lazy"
    @load="follow"
  />
</template>

<style scoped>
.tour-frame {
  display: block;
  inline-size: 100%;
  block-size: var(--tour-frame-height);
  border: 0;
  border-radius: var(--site-radius-control);
  /* Shows only until the example paints. */
  background: var(--site-color-surface);
}
</style>
