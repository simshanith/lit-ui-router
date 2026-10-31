<script setup lang="ts">
import { useTemplateRef, ref, computed, onMounted, onUnmounted } from 'vue';
import screenfull from 'screenfull';
import { VPIcon } from 'vitepress/theme';
import ExampleEmbed from './ExampleEmbed.vue';
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

const container = useTemplateRef('container');

// Unknown until mounted; the button renders either way so the row never reflows.
const isFullscreenSupported = ref<boolean>();

const isFullscreen = ref(false);

const toggleFullscreen = () => {
  if (screenfull.isEnabled && container.value) {
    screenfull.toggle(container.value);
  }
};

const handleFullscreenChange = () => {
  isFullscreen.value = screenfull.isFullscreen;
};

const iframe = useTemplateRef('iframe');

function refreshIframe() {
  const el = iframe.value;

  if (el) el.src += '';
}

onMounted(async () => {
  embedSupported.value = webContainersSupported();
  isFullscreenSupported.value = screenfull.isEnabled;

  if (screenfull.isEnabled) {
    screenfull.on('change', handleFullscreenChange);
  }
});

onUnmounted(() => {
  if (screenfull.isEnabled) {
    screenfull.off('change', handleFullscreenChange);
  }
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
  <div
    v-else
    ref="container"
    class="stackblitz-embed"
    :class="{ fullscreen: isFullscreen }"
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
        class="fullscreen-btn site-button"
        :disabled="isFullscreenSupported === false"
        :title="
          isFullscreenSupported === false
            ? 'Fullscreen is not supported in this browser'
            : undefined
        "
        @click="toggleFullscreen"
      >
        <!-- Both render: the build only ships CSS for icons in the server render. -->
        <span class="site-button-icon">
          <VPIcon
            v-show="!isFullscreen"
            icon="lucide:maximize"
            aria-hidden="true"
          />
          <VPIcon
            v-show="isFullscreen"
            icon="lucide:minimize"
            aria-hidden="true"
          />
        </span>
        {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
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
  </div>
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

/* The frame flexes into whatever the padding, gap and a wrapped action row leave. */
.stackblitz-embed:fullscreen,
.stackblitz-embed:-webkit-full-screen {
  display: flex;
  flex-direction: column;
  gap: var(--example-actions-gap);
  background: var(--site-color-surface);
  padding: var(--site-space-4);
}

.stackblitz-embed:fullscreen iframe,
.stackblitz-embed:-webkit-full-screen iframe {
  flex: 1 1 0;
  min-height: 0;
  max-height: none;
  height: auto;
  aspect-ratio: auto;
  width: 88%;
}

.stackblitz-embed:fullscreen .stackblitz-embed-actions,
.stackblitz-embed:-webkit-full-screen .stackblitz-embed-actions {
  margin-block-start: 0;
}

.stackblitz-embed.fullscreen:fullscreen iframe,
.stackblitz-embed.fullscreen:-webkit-full-screen iframe {
  width: 100%;
}

@media (prefers-reduced-motion: no-preference) {
  .stackblitz-embed {
    transition:
      padding var(--site-duration-slow) var(--ease-out),
      width var(--site-duration-slow) var(--ease-out);
  }

  .stackblitz-embed iframe {
    transition:
      height var(--site-duration-slow) var(--ease-out),
      width var(--site-duration-slow) var(--ease-out);
  }

  .stackblitz-embed:fullscreen iframe,
  .stackblitz-embed:-webkit-full-screen iframe {
    transition:
      height var(--site-duration-slow) var(--ease-out),
      width 0s;
  }

  .stackblitz-embed.fullscreen:fullscreen iframe,
  .stackblitz-embed.fullscreen:-webkit-full-screen iframe {
    transition:
      height var(--site-duration-slow) var(--ease-out),
      width var(--site-duration-slow) var(--ease-out);
  }
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
