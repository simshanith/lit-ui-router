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
        class="fullscreen-btn btn"
        :disabled="isFullscreenSupported === false"
        :title="
          isFullscreenSupported === false
            ? 'Fullscreen is not supported in this browser'
            : undefined
        "
        @click="toggleFullscreen"
      >
        <span class="btn-icon">
          <sp-icon-full-screen-exit v-if="isFullscreen" />
          <sp-icon-full-screen v-else />
        </span>
        {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
      </button>
      <button @click="restartIframe" class="restart-btn btn" type="button">
        <span class="btn-icon">
          <sp-icon-refresh label="Restart example" />
        </span>
        Restart
      </button>
      <a :href="src" target="_blank" rel="noopener" class="open-btn btn">
        <span class="btn-icon"><sp-icon-link-out /></span>
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
  height: min(var(--embed-height, 420px), calc(100svh - 120px));
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  overflow: clip;
  background: #fff;
  margin: auto;
}

/* The frame flexes into whatever the padding, gap and a wrapped action row leave. */
.example-embed:fullscreen,
.example-embed:-webkit-full-screen {
  display: flex;
  flex-direction: column;
  gap: var(--example-actions-gap);
  background: var(--vp-c-bg);
  padding: 16px;
}

.example-embed:fullscreen iframe,
.example-embed:-webkit-full-screen iframe {
  flex: 1 1 0;
  min-height: 0;
  height: auto;
  border-radius: 8px;
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
      padding 0.3s var(--ease-out),
      width 0.3s var(--ease-out);
  }

  .example-embed iframe {
    transition:
      height 0.3s var(--ease-out),
      width 0.3s var(--ease-out),
      border-radius 0.3s var(--ease-out);
  }

  .example-embed:fullscreen iframe,
  .example-embed:-webkit-full-screen iframe {
    transition:
      height 0.3s var(--ease-out),
      width 0s,
      border-radius 0.3s var(--ease-out);
  }

  .example-embed.fullscreen:fullscreen iframe,
  .example-embed.fullscreen:-webkit-full-screen iframe {
    transition:
      height 0.3s var(--ease-out),
      width 0.3s var(--ease-out),
      border-radius 0.3s var(--ease-out);
  }
}

.example-embed-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-block-start: var(--example-actions-gap);
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding-block: 6px;
  padding-inline: 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  text-decoration: none;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  min-block-size: var(--example-control-size);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color 0.2s var(--ease-out),
    border-color 0.2s var(--ease-out),
    transform 0.15s var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .btn:hover {
    background: var(--vp-c-bg-mute);
    border-color: var(--vp-c-brand-1);
  }
}

.btn:active {
  transform: scale(0.97);
}

.btn:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 1px;
}

.btn:disabled {
  color: var(--vp-c-text-3);
  cursor: not-allowed;
}

/* Holds the async-loaded icon's box from the server render on. */
.btn-icon {
  display: inline-flex;
  flex: none;
  inline-size: var(--example-icon-size);
  block-size: var(--example-icon-size);
}
</style>
