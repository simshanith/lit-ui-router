<script setup lang="ts">
import { useTemplateRef, ref, computed, onMounted } from 'vue';
import { VPIcon } from 'vitepress/theme';
import ExampleEmbed from './ExampleEmbed.vue';
import { useExpandDialog } from './expand-dialog';
import { webContainersSupported } from './webcontainers';

const props = defineProps<{
  src: string;
  title: string;
  fallbackSrc?: string;
  fallbackHeight?: string;
}>();

const embedSupported = ref(true);

// The embed src minus embed/view params = the full editor workspace URL.
const openUrl = computed(() => {
  const url = new URL(props.src);
  url.searchParams.delete('embed');
  url.searchParams.delete('view');

  return url.toString();
});

const dialog = useTemplateRef('dialog');

const { expanded, toggle, onClose } = useExpandDialog(dialog);

const iframe = useTemplateRef('iframe');

function refreshIframe() {
  const el = iframe.value;

  if (el) el.src += '';
}

onMounted(() => {
  embedSupported.value = webContainersSupported();
});
</script>

<template>
  <div v-if="!embedSupported" class="stackblitz-fallback">
    <p class="fallback-note">
      Embedded StackBlitz (WebContainers) isn't supported in this browser.
      <template v-if="fallbackSrc">
        Here's the built example instead — open the workspace on a supported
        device to edit the code.
      </template>
      <template v-else
        >Open the workspace on a supported device instead.</template
      >
    </p>
    <ExampleEmbed
      v-if="fallbackSrc"
      :src="fallbackSrc"
      :title="title"
      :height="fallbackHeight"
    >
      <a :href="openUrl" target="_blank" rel="noopener" class="site-button">
        Open in StackBlitz
      </a>
    </ExampleEmbed>
    <a
      v-else
      :href="openUrl"
      target="_blank"
      rel="noopener"
      class="site-button"
    >
      Open in StackBlitz
    </a>
  </div>
  <dialog
    v-else
    ref="dialog"
    class="stackblitz-embed site-expand"
    :aria-label="title"
    @close="onClose"
  >
    <iframe
      :src="src"
      :title="title"
      ref="iframe"
      allow="cross-origin-isolated"
      credentialless
      sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
    />
    <div class="stackblitz-embed-actions">
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
        @click="refreshIframe"
        class="refresh-btn site-button"
        type="button"
      >
        <span class="site-button-icon">
          <VPIcon icon="lucide:rotate-cw" aria-hidden="true" />
        </span>
        Restart
      </button>
      <slot></slot>
    </div>
  </dialog>
</template>

<style scoped>
.stackblitz-embed {
  width: 100%;
}

.stackblitz-embed iframe {
  width: 100%;
  max-width: 100%;
  /* The editor keeps its own shape regardless of the example's preview
     height: 16:10 of the container width, floored so narrow screens still
     get a usable editor, capped on short viewports (svh dodges mobile
     browser toolbars). */
  height: auto;
  aspect-ratio: 16 / 10;
  min-height: 320px;
  max-height: var(--example-frame-max-height);
  border: 0;
  border-radius: var(--site-radius-control);
  overflow: clip;
  margin: auto;
}

/* Expanded, the frame flexes into whatever the padding, gap and a wrapped action row leave. */
.stackblitz-embed:modal iframe {
  flex: 1 1 0;
  min-height: 0;
  max-height: none;
  height: auto;
  aspect-ratio: auto;
}

.stackblitz-embed:modal .stackblitz-embed-actions {
  margin-block-start: 0;
}

.stackblitz-embed-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--site-space-3);
  margin-block-start: var(--example-actions-gap);
}

.fallback-note {
  margin-block: 0 var(--site-space-2);
  padding-block: var(--site-space-2);
  padding-inline: var(--site-space-3);
  font-size: var(--site-text-sm);
  color: var(--site-color-text-muted);
  background: var(--site-color-surface-soft);
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-control);
}

/* Framed like the sibling .site-button controls; border present in both states so
   hover changes color only, never size. */
.stackblitz-embed-actions :deep(a) {
  display: inline-flex;
  align-items: center;
  line-height: 0;
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-control);
  overflow: clip;
  transition: border-color var(--site-duration-base) var(--ease-out);
}

.stackblitz-embed-actions :deep(a img) {
  display: block;
  /* Inside the frame's border, level with the sibling .site-button controls. */
  height: calc(var(--example-control-size) - 2 * var(--site-border-width));
  /* .vp-doc gives content imgs 16px vertical margin — the actual gap culprit. */
  margin: 0;
}

@media (hover: hover) and (pointer: fine) {
  .stackblitz-embed-actions :deep(a:hover) {
    border-color: var(--site-color-interaction);
  }
}
</style>
