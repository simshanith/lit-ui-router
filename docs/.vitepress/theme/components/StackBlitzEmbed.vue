<script setup lang="ts">
import { useTemplateRef, ref, computed, onMounted, onUnmounted } from 'vue';
import screenfull from 'screenfull';
import ExampleEmbed from './ExampleEmbed.vue';

const props = defineProps<{
  src: string;
  title: string;
  fallbackSrc?: string;
  fallbackHeight?: string;
}>();

// StackBlitz WebContainers never boot on iOS (every iOS browser is WebKit),
// so swap the embed for the static example / an external link there.
function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as macOS; touch support tells it apart.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

const embedSupported = ref(true);

// The embed src minus embed/view params = the full editor workspace URL.
const openUrl = computed(() => {
  const url = new URL(props.src);
  url.searchParams.delete('embed');
  url.searchParams.delete('view');
  return url.toString();
});

const container = useTemplateRef('container');
const isFullscreenSupported = ref(false);
const isFullscreen = ref(false);
const iconsLoaded = ref(false);

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

async function loadIcons() {
  await Promise.all([
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-full-screen.js'),
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-full-screen-exit.js'),
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-refresh.js'),
  ]);
  iconsLoaded.value = true;
}

if (!import.meta.env.SSR) {
  loadIcons();
}

onMounted(async () => {
  embedSupported.value = !isIOS();
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
      <a :href="openUrl" target="_blank" rel="noopener" class="btn">
        Open in StackBlitz
      </a>
    </ExampleEmbed>
    <a v-else :href="openUrl" target="_blank" rel="noopener" class="btn">
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
        v-if="isFullscreenSupported"
        type="button"
        class="fullscreen-btn btn"
        @click="toggleFullscreen"
      >
        <sp-icon-full-screen-exit v-if="iconsLoaded && isFullscreen" />
        <sp-icon-full-screen v-if="iconsLoaded && !isFullscreen" />
        {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
      </button>
      <button @click="refreshIframe" class="refresh-btn btn">
        <sp-icon-refresh v-if="iconsLoaded" label="Refresh iframe" />
      </button>
      <slot></slot>
    </div>
  </div>
</template>

<style scoped>
.stackblitz-embed {
  width: 100%;
  transition:
    padding 0.3s ease,
    width 0.3s ease;
}

.stackblitz-embed iframe {
  width: 100%;
  max-width: 100%;
  height: 400px;
  /* Cap on short viewports (svh dodges mobile browser toolbars). */
  height: min(400px, calc(100svh - 120px));
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  transition:
    height 0.3s ease,
    width 0.3s ease,
    border-radius 0.3s ease;
  margin: auto;
}

.stackblitz-embed:fullscreen,
.stackblitz-embed:-webkit-full-screen {
  background: var(--vp-c-bg);
  padding: 16px;
}

.stackblitz-embed:fullscreen iframe,
.stackblitz-embed:-webkit-full-screen iframe {
  height: calc(100vh - 80px);
  border-radius: 8px;
  width: 88%;
  transition:
    height 0.3s ease,
    width 0s ease,
    border-radius 0.3s ease;
}

.stackblitz-embed.fullscreen:fullscreen iframe,
.stackblitz-embed.fullscreen:-webkit-full-screen iframe {
  width: 100%;
  transition:
    height 0.3s ease,
    width 0.3s ease,
    border-radius 0.3s ease;
}

.stackblitz-embed-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.fallback-note {
  margin: 0 0 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  text-decoration: none;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    border-color 0.2s;
}

.btn:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand-1);
}

/* Framed like the sibling .btn controls; border present in both states so
   hover changes color only, never size. */
.stackblitz-embed-actions :deep(a) {
  display: inline-flex;
  align-items: center;
  line-height: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.2s;
}

.stackblitz-embed-actions :deep(a img) {
  display: block;
  /* 36px + the 1px frame = 38px, level with the sibling .btn controls. */
  height: 36px;
  /* .vp-doc gives content imgs 16px vertical margin — the actual gap culprit. */
  margin: 0;
}

.stackblitz-embed-actions :deep(a:hover) {
  border-color: var(--vp-c-brand-1);
}
</style>
