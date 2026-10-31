<script setup lang="ts">
import { useTemplateRef, ref, onMounted, onUnmounted } from 'vue';
import screenfull from 'screenfull';

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

function loadIcons() {
  return Promise.all([
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-full-screen.js'),
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-full-screen-exit.js'),
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-refresh.js'),
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-link-out.js'),
  ]);
}

if (!import.meta.env.SSR) {
  loadIcons();
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
        class="fullscreen-btn lur-button"
        :disabled="isFullscreenSupported === false"
        :title="
          isFullscreenSupported === false
            ? 'Fullscreen is not supported in this browser'
            : undefined
        "
        @click="toggleFullscreen"
      >
        <span class="lur-button-icon">
          <sp-icon-full-screen-exit v-if="isFullscreen" />
          <sp-icon-full-screen v-else />
        </span>
        {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
      </button>
      <button
        @click="restartIframe"
        class="restart-btn lur-button"
        type="button"
      >
        <span class="lur-button-icon">
          <sp-icon-refresh label="Restart example" />
        </span>
        Restart
      </button>
      <a :href="src" target="_blank" rel="noopener" class="open-btn lur-button">
        <span class="lur-button-icon"><sp-icon-link-out /></span>
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
  border: var(--lur-border-width) solid var(--vp-c-divider);
  border-radius: var(--lur-radius-control);
  overflow: clip;
  /* Shows only until the example paints; an example without color-scheme gets the UA's light canvas. */
  background: var(--vp-c-bg);
  margin: auto;
}

/* The frame flexes into whatever the padding, gap and a wrapped action row leave. */
.example-embed:fullscreen,
.example-embed:-webkit-full-screen {
  display: flex;
  flex-direction: column;
  gap: var(--example-actions-gap);
  background: var(--vp-c-bg);
  padding: var(--lur-space-4);
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
      padding var(--lur-duration-slow) var(--ease-out),
      width var(--lur-duration-slow) var(--ease-out);
  }

  .example-embed iframe {
    transition:
      height var(--lur-duration-slow) var(--ease-out),
      width var(--lur-duration-slow) var(--ease-out);
  }

  .example-embed:fullscreen iframe,
  .example-embed:-webkit-full-screen iframe {
    transition:
      height var(--lur-duration-slow) var(--ease-out),
      width 0s;
  }

  .example-embed.fullscreen:fullscreen iframe,
  .example-embed.fullscreen:-webkit-full-screen iframe {
    transition:
      height var(--lur-duration-slow) var(--ease-out),
      width var(--lur-duration-slow) var(--ease-out);
  }
}

.example-embed-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--lur-space-3);
  margin-block-start: var(--example-actions-gap);
}
</style>
