<script setup lang="ts">
import manifestUrl from 'lit-ui-router/custom-elements.json?url';
import { onMounted, ref } from 'vue';

// The viewer is a lit element with no server render: its definition loads in the browser, and the tag upgrades in place.
const failed = ref(false);

// Another element or tab is a different height, so the reservation ends at the first interaction.
const used = ref(false);

onMounted(async () => {
  try {
    await import('@api-viewer/docs');
  } catch (error) {
    console.error(error);
    failed.value = true;
  }
});
</script>

<template>
  <div
    class="element-api-viewer"
    :class="{ used: used || failed }"
    @pointerdown="used = true"
    @focusin="used = true"
  >
    <p v-if="failed" class="element-api-viewer-failed">
      The viewer did not load. The list above names the same elements and
      members.
    </p>
    <!-- A dynamic component: Vue renders an unregistered name as the element itself. -->
    <component :is="'api-docs'" v-else :src="manifestUrl" />
  </div>
</template>

<style scoped>
/* Holds the least height of the first element's Properties tab at each layout, so the page below barely moves when the viewer upgrades. */
.element-api-viewer {
  margin-block: var(--site-space-4);
}

.element-api-viewer:not(.used) {
  min-block-size: 39.5rem;
}

/* The viewer stacks its header and columns at 480px and under. */
@media (width <= 480px) {
  .element-api-viewer:not(.used) {
    min-block-size: 59.5rem;
  }
}

.element-api-viewer-failed {
  color: var(--site-color-text-muted);
}

/* The viewer seeds its --ave-* properties on :host, so only rules on the element itself override them. */
api-docs {
  --ave-primary-color: var(--site-color-interaction);
  --ave-secondary-color: var(--site-color-text-muted);
  --ave-accent-color: var(--site-color-text);
  --ave-border-color: var(--site-color-line);
  --ave-border-radius: var(--site-radius-control);
  --ave-header-background: var(--site-color-surface-soft);
  --ave-header-color: var(--site-color-text);
  --ave-item-color: var(--site-color-text);
  --ave-label-color: var(--site-color-text-muted);
  --ave-link-color: var(--site-color-interaction);
  --ave-link-hover-color: var(--site-color-interaction-hover);
  --ave-tab-color: var(--site-color-text-muted);
  --ave-tag-background-color: var(--site-color-surface-soft);
  --ave-tag-border-color: var(--site-color-line);
  --ave-tag-color: var(--site-color-text-muted);
  --ave-monospace-font: var(--vp-font-family-mono);

  /* Its own sheet sets a 360px floor, an 800px cap, a system font and, under a dark OS scheme, a white ground. */
  min-inline-size: 0;
  max-inline-size: none;
  font-family: inherit;
  color: var(--site-color-text);
  background: var(--site-color-surface);
}

api-docs::part(header) {
  border-block-end: var(--site-border-width) solid var(--site-color-line);
}

api-docs::part(select) {
  padding-block: var(--site-space-1);
  padding-inline: var(--site-space-2);
  font: inherit;
  font-size: var(--site-text-sm);
  color: var(--site-color-text);
  background: var(--site-color-surface);
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-control);
}

api-docs::part(tab) {
  font-size: var(--site-text-sm);
  text-transform: none;
}

api-docs::part(docs-label) {
  letter-spacing: 0;
}

/* The viewer's tab removes its outline and marks focus with a faint wash only. */
api-docs::part(select):focus-visible,
api-docs::part(tab):focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: calc(-1 * var(--site-focus-ring-width));
}
</style>
