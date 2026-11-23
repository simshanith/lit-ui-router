<script setup lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from 'vue';
import { stateUrlOf } from 'examples/features-tour/state-links';

const { prefix, headingLevel } = defineProps<{
  /** What the tour's state fragments start with: `#<prefix>/views`. */
  prefix: string;
  /** The card heading's level under the heading this sits beneath. */
  headingLevel: number;
}>();

const emit = defineEmits<{
  /** Each card the app's router enters, the first included. */
  card: [card: { id: string; title: string }];
}>();

const host = useTemplateRef('host');

let nearby: IntersectionObserver | undefined;

let gone = false;

let unmount: (() => void) | undefined;

// The tour and its router are one lazy chunk; nothing of them is in the prerendered page.
async function mount() {
  nearby?.disconnect();

  const { mountTour } = await import('examples/features-tour/embed');

  // The page can be navigated away from while the chunk loads.
  if (gone || !host.value) return;

  unmount = mountTour(host.value, {
    prefix,
    headingLevel,
    onCard: (card) => emit('card', card),
  });
}

onMounted(() => {
  // A page opened on one of the tour's states wants it now; any other waits until the section is two screens away.
  if (stateUrlOf(location.hash, prefix) !== undefined) {
    void mount();

    return;
  }

  nearby = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void mount();
    },
    { rootMargin: '200%' },
  );
  nearby.observe(host.value!);
});

// Client-side navigation keeps the window: the router must stop listening to it when this page goes.
onBeforeUnmount(() => {
  gone = true;
  nearby?.disconnect();
  unmount?.();
});
</script>

<template>
  <div ref="host" class="tour" />
</template>

<style scoped>
/* Holds the tour's space until it mounts, so the page below it does not move. */
.tour:empty {
  min-block-size: var(--tour-height, auto);
}
</style>
