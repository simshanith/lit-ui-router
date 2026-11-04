<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import { VPIcon } from 'vitepress/theme';

// Wraps one inlined diagram; the slot is the `<!--@include: …svg-->`, src the same file served standalone.
defineProps<{ src: string }>();

const dialog = useTemplateRef('dialog');

const expanded = ref(false);

// The diagram's <title> and viewBox aspect, read once the slot is in the DOM.
const title = ref('');

const ratio = ref<number>();

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

onMounted(() => {
  const svg = dialog.value?.querySelector('svg');
  const box = svg?.viewBox.baseVal;

  title.value = svg?.querySelector(':scope > title')?.textContent?.trim() ?? '';
  ratio.value = box?.height ? box.width / box.height : undefined;
});
</script>

<template>
  <!-- One node both ways: closed it shows inline, showModal() lifts it to the top layer. -->
  <dialog
    ref="dialog"
    class="diagram-embed"
    :aria-label="title || undefined"
    :style="ratio ? { '--diagram-ratio': ratio } : undefined"
    @close="expanded = false"
  >
    <div class="diagram-embed-canvas">
      <slot></slot>
    </div>
    <div class="diagram-embed-actions">
      <button
        type="button"
        class="diagram-embed-expand site-button"
        @click="toggle"
      >
        <!-- Both render: the build only ships CSS for icons in the server render. -->
        <span class="site-button-icon">
          <VPIcon
            v-show="!expanded"
            icon="lucide:maximize"
            aria-hidden="true"
          />
          <VPIcon v-show="expanded" icon="lucide:minimize" aria-hidden="true" />
        </span>
        {{ expanded ? 'Close' : 'Expand' }}
      </button>
      <a :href="src" target="_blank" rel="noopener" class="site-button">
        <span class="site-button-icon">
          <VPIcon icon="lucide:external-link" aria-hidden="true" />
        </span>
        Open full size<span v-if="title" class="visually-hidden"
          >: {{ title }}</span
        >
      </a>
    </div>
  </dialog>
</template>

<!-- Unscoped: the slotted svg carries the page's scope id, not this component's. -->
<style>
.diagram-embed:not([open]) {
  display: block;
}

.diagram-embed {
  position: static;
  inline-size: auto;
  block-size: auto;
  max-inline-size: none;
  max-block-size: none;
  margin: 0;
  margin-block: var(--site-space-4);
  padding: 0;
  border: 0;
  color: inherit;
  background: transparent;
}

/* Inline, no wider than the drawn canvas. */
.vp-doc .diagram-embed svg[role='img'] {
  max-inline-size: 720px;
  margin-block: 0;
}

.diagram-embed-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--site-space-3);
  margin-block-start: var(--example-actions-gap);
}

/* In viewports below VitePress's 768px breakpoint, Open full size is the way to read a diagram large: the standalone file pinch-zooms. */
.diagram-embed .diagram-embed-actions .diagram-embed-expand {
  display: none;
}

/* Open, it stays at any width: a window narrowed mid-view has no other visible way out. */
.diagram-embed[open] .diagram-embed-actions .diagram-embed-expand {
  display: inline-flex;
}

@media (min-width: 768px) {
  .diagram-embed .diagram-embed-actions .diagram-embed-expand {
    display: inline-flex;
  }
}

/* Fills the window; the canvas flexes into what the action row leaves. */
.diagram-embed:modal {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: var(--example-actions-gap);
  box-sizing: border-box;
  inline-size: 100dvw;
  block-size: 100dvh;
  margin: 0;
  padding: var(--site-space-4);
  background: var(--site-color-surface);
}

.diagram-embed::backdrop {
  background: var(--site-color-surface);
}

.diagram-embed:modal .diagram-embed-canvas {
  display: flex;
  flex: 1 1 0;
  min-block-size: 0;
  container-type: size;
}

.diagram-embed:modal .diagram-embed-actions {
  margin-block-start: 0;
}

/* Fits the canvas at the viewBox aspect, centred. */
.vp-doc .diagram-embed:modal svg[role='img'] {
  flex: none;
  inline-size: min(100cqi, 100cqb * var(--diagram-ratio));
  max-inline-size: none;
  block-size: auto;
  margin: auto;
  padding: 0;
  border: 0;
}

html:has(.diagram-embed:modal) {
  overflow: hidden;
}
</style>
