<script setup lang="ts">
import { useTemplateRef, ref, onMounted, onUnmounted } from 'vue';
import screenfull from 'screenfull';
import { VPIcon } from 'vitepress/theme';

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

function restartIframe() {
  const el = iframe.value;

  if (el) el.src += '';
}

onMounted(async () => {
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
  <div
    ref="container"
    class="example-embed"
    :class="{ fullscreen: isFullscreen }"
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
  </div>
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

/* The frame flexes into whatever the padding, gap and a wrapped action row leave. */
.example-embed:fullscreen,
.example-embed:-webkit-full-screen {
  display: flex;
  flex-direction: column;
  gap: var(--example-actions-gap);
  background: var(--site-color-surface);
  padding: var(--site-space-4);
}

.example-embed:fullscreen iframe,
.example-embed:-webkit-full-screen iframe {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
  width: 88%;
}

.example-embed:fullscreen .example-embed-actions,
.example-embed:-webkit-full-screen .example-embed-actions {
  margin-block-start: 0;
}

.example-embed.fullscreen:fullscreen iframe,
.example-embed.fullscreen:-webkit-full-screen iframe {
  width: 100%;
}

@media (prefers-reduced-motion: no-preference) {
  .example-embed {
    transition:
      padding var(--site-duration-slow) var(--ease-out),
      width var(--site-duration-slow) var(--ease-out);
  }

  .example-embed iframe {
    transition:
      height var(--site-duration-slow) var(--ease-out),
      width var(--site-duration-slow) var(--ease-out);
  }

  .example-embed:fullscreen iframe,
  .example-embed:-webkit-full-screen iframe {
    transition:
      height var(--site-duration-slow) var(--ease-out),
      width 0s;
  }

  .example-embed.fullscreen:fullscreen iframe,
  .example-embed.fullscreen:-webkit-full-screen iframe {
    transition:
      height var(--site-duration-slow) var(--ease-out),
      width var(--site-duration-slow) var(--ease-out);
  }
}

.example-embed-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--site-space-3);
  margin-block-start: var(--example-actions-gap);
}
</style>
