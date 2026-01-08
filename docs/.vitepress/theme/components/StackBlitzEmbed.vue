<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import screenfull from 'screenfull';

const props = defineProps<{
  src: string;
  title: string;
}>();

const container = ref<HTMLElement | null>(null);
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

async function loadIcons() {
  await Promise.all([
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-full-screen.js'),
    import('@spectrum-web-components/icons-workflow/icons/sp-icon-full-screen-exit.js'),
  ]);
  iconsLoaded.value = true;
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
  <div ref="container" class="stackblitz-embed" :class="{ fullscreen: isFullscreen }">
    <iframe
      :src="src"
      :title="title"
      credentialless
      sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
    />
    <div class="stackblitz-embed-actions">
      <button
        v-if="isFullscreenSupported && iconsLoaded"
        type="button"
        class="fullscreen-btn"
        @click="toggleFullscreen"
      >
        <sp-icon-full-screen-exit v-if="isFullscreen" />
        <sp-icon-full-screen v-else />
        {{ isFullscreen ? 'Exit Fullscreen' : 'Fullscreen' }}
      </button>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.stackblitz-embed {
  width: 100%;
  transition: padding 0.3s ease, width 0.3s ease;
}

.stackblitz-embed iframe {
  width: 100%;
  height: 400px;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  transition: height 0.3s ease, width 0.3s ease, border-radius 0.3s ease;
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
  transition: height 0.3s ease, width 0s ease, border-radius 0.3s ease;
}

.stackblitz-embed.fullscreen:fullscreen iframe,
.stackblitz-embed.fullscreen:-webkit-full-screen iframe {
  width: 100%;
  transition: height 0.3s ease, width 0.3s ease, border-radius 0.3s ease;
}

.stackblitz-embed-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.fullscreen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.fullscreen-btn:hover {
  background: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand-1);
}

.open-btn {
  display: inline-flex;
  align-items: center;
}

.open-btn img {
  height: 32px;
}
</style>
