<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { VPIcon } from 'vitepress/theme';
import { useExpandDialog } from './expand-dialog';

// Same-origin iframe embed for the tutorial examples served at
// /examples/<name>/ — no StackBlitz boot, just the built app.
const props = withDefaults(
  defineProps<{
    src: string;
    title: string;
    height?: string;
  }>(),
  { height: '420px' },
);

const dialog = useTemplateRef('dialog');

const { expanded, toggle, onClose } = useExpandDialog(dialog);

const iframe = useTemplateRef('iframe');

function restartIframe() {
  const el = iframe.value;

  if (el) el.src += '';
}
</script>

<template>
  <dialog
    ref="dialog"
    class="example-embed site-expand"
    :aria-label="title"
    @close="onClose"
  >
    <iframe
      :src="src"
      :title="title"
      :style="{ '--embed-height': props.height }"
      ref="iframe"
      loading="lazy"
    />
    <div class="example-embed-actions">
      <button
        type="button"
        class="site-expand-button site-button"
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
      <button
        @click="restartIframe"
        class="restart-btn site-button"
        type="button"
      >
        <span class="site-button-icon">
          <VPIcon icon="lucide:rotate-cw" aria-hidden="true" />
        </span>
        Restart
      </button>
      <a
        :href="src"
        target="_blank"
        rel="noopener"
        class="open-btn site-button"
      >
        <span class="site-button-icon">
          <VPIcon icon="lucide:external-link" aria-hidden="true" />
        </span>
        Open in new tab
      </a>
      <slot></slot>
    </div>
  </dialog>
</template>

<style scoped>
.example-embed {
  width: 100%;
}

.example-embed iframe {
  width: 100%;
  max-width: 100%;
  height: var(--embed-height, 420px);
  /* Cap tall embeds so small viewports keep the page (svh dodges iOS toolbars). */
  height: min(var(--embed-height, 420px), var(--example-frame-max-height));
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-control);
  overflow: clip;
  /* Shows only until the example paints; an example without color-scheme gets the UA's light canvas. */
  background: var(--site-color-surface);
  margin: auto;
}

/* Expanded, the frame flexes into whatever the padding, gap and a wrapped action row leave. */
.example-embed:modal iframe {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
}

.example-embed:modal .example-embed-actions {
  margin-block-start: 0;
}

.example-embed-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--site-space-3);
  margin-block-start: var(--example-actions-gap);
}
</style>
