<script setup lang="ts">
import { ref, computed, onMounted, useId } from 'vue';
import ExampleEmbed from './ExampleEmbed.vue';
import StackBlitzEmbed from './StackBlitzEmbed.vue';
import {
  EXAMPLES,
  staticSrc,
  stackblitzEmbedSrc,
  stackblitzOpenSrc,
  type ExampleName,
} from './examples';
import { webContainersSupported } from './webcontainers';

const props = defineProps<{
  name: ExampleName;
  height?: string;
  file?: string;
}>();

type Mode = 'preview' | 'stackblitz';
const STORAGE_KEY = 'lit-ui-router:live-example-mode';
// Site-wide preference; instances read it on mount but never follow later writes.
const preference = ref<Mode>('preview');

const example = computed(() => EXAMPLES[props.name]);
const previewSrc = computed(() => staticSrc(props.name));
const embedSrc = computed(() => stackblitzEmbedSrc(props.name, props.file));
const openSrc = computed(() => stackblitzOpenSrc(props.name, props.file));
const previewHeight = computed(() => props.height ?? example.value.height);

const uid = useId();
const active = ref<Mode>('preview');
const supported = ref(true);
// First StackBlitz selection boots the iframe; v-show keeps it alive after.
const stackblitzBooted = ref(false);

function selectTab(mode: Mode, persist = true) {
  active.value = mode;
  if (mode === 'stackblitz' && supported.value) stackblitzBooted.value = true;
  if (persist) {
    preference.value = mode;
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage unavailable (private mode etc.) — preference just won't persist.
    }
  }
}

onMounted(() => {
  supported.value = webContainersSupported();
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }
  if (stored === 'preview' || stored === 'stackblitz') {
    preference.value = stored;
  }
  if (supported.value && preference.value === 'stackblitz') {
    selectTab('stackblitz', false);
  }
});
</script>

<template>
  <div class="live-example">
    <div class="live-example-bar">
      <div
        class="live-example-tablist"
        role="tablist"
        :aria-label="`${example.title} example`"
      >
        <button
          type="button"
          role="tab"
          class="tab"
          :id="`${uid}-tab-preview`"
          :aria-selected="active === 'preview'"
          :aria-controls="`${uid}-panel-preview`"
          :class="{ active: active === 'preview' }"
          @click="selectTab('preview')"
        >
          Preview
        </button>
        <button
          type="button"
          role="tab"
          class="tab"
          :id="`${uid}-tab-stackblitz`"
          :aria-selected="active === 'stackblitz'"
          :aria-controls="`${uid}-panel-stackblitz`"
          :class="{ active: active === 'stackblitz' }"
          @click="selectTab('stackblitz')"
        >
          Edit in StackBlitz
        </button>
      </div>
      <a class="open-badge" :href="openSrc" target="_blank" rel="noopener">
        <img
          alt="Open in StackBlitz"
          src="https://developer.stackblitz.com/img/open_in_stackblitz.svg"
        />
      </a>
    </div>
    <div
      class="live-example-panels"
      :style="{ '--embed-height': previewHeight }"
    >
      <div
        v-show="active === 'preview'"
        role="tabpanel"
        :id="`${uid}-panel-preview`"
        :aria-labelledby="`${uid}-tab-preview`"
      >
        <ExampleEmbed
          :src="previewSrc"
          :title="`${example.title} example`"
          :height="previewHeight"
        />
      </div>
      <div
        v-show="active === 'stackblitz'"
        role="tabpanel"
        :id="`${uid}-panel-stackblitz`"
        :aria-labelledby="`${uid}-tab-stackblitz`"
      >
        <template v-if="supported">
          <StackBlitzEmbed
            v-if="stackblitzBooted"
            :src="embedSrc"
            :title="`lit-ui-router-${props.name}`"
          />
        </template>
        <div v-else class="fallback-note">
          <p>
            StackBlitz's in-browser environment isn't supported here (e.g. iOS
            Safari). Use the Preview tab to try the running example, or
            <a :href="openSrc" target="_blank" rel="noopener"
              >open the workspace on StackBlitz</a
            >
            from a supported device.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-example {
  margin: 16px 0;
  container-type: inline-size;
}

.live-example-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}

.live-example-tablist {
  display: inline-flex;
  gap: 4px;
  padding: 3px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.tab {
  padding: 5px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  transition:
    background-color 0.2s,
    color 0.2s;
}

.tab:hover {
  color: var(--vp-c-text-1);
}

.tab.active {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  box-shadow: 0 0 0 1px var(--vp-c-divider);
}

.open-badge {
  display: inline-flex;
  align-items: center;
  line-height: 0;
  margin-left: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.2s;
}

/* Below the tabs+badge intrinsic width the bar wraps the badge onto its own
   row — align it with the tabs instead of the far edge. */
@container (max-width: 420px) {
  .open-badge {
    margin-left: 0;
  }
}

.open-badge:hover {
  border-color: var(--vp-c-brand-1);
}

.open-badge img {
  display: block;
  height: 36px;
  /* .vp-doc gives content imgs 16px vertical margin — kill the gap. */
  margin: 0;
}

/* Reserve the taller (preview) pane's frame height so tab switches don't shift the page. */
.live-example-panels {
  min-height: min(var(--embed-height, 420px), calc(100svh - 120px));
}

.fallback-note {
  padding: 8px 12px;
  font-size: 14px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
}

.fallback-note p {
  margin: 0;
}
</style>
