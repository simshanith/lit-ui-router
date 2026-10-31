<script setup lang="ts">
import { ref, computed, onMounted, useId } from 'vue';
import { VPIcon } from 'vitepress/theme';
import ExampleEmbed from './ExampleEmbed.vue';
import StackBlitzEmbed from './StackBlitzEmbed.vue';
import {
  EXAMPLES,
  githubTreeSrc,
  staticSrc,
  stackblitzEmbedSrc,
  stackblitzOpenSrc,
  type ExampleName,
  type StackBlitzView,
} from './examples';
import { webContainersSupported } from './webcontainers';

const props = withDefaults(
  defineProps<{
    name: ExampleName;
    height?: string;
    file?: string;
    /** Pass 'default' to hand the choice back to StackBlitz. */
    view?: StackBlitzView;
  }>(),
  { view: 'editor' },
);

type Mode = 'preview' | 'stackblitz';

const example = computed(() => EXAMPLES[props.name]);

const previewSrc = computed(() => staticSrc(props.name));

const embedSrc = computed(() =>
  stackblitzEmbedSrc(props.name, props.file, props.view),
);

const openSrc = computed(() => stackblitzOpenSrc(props.name, props.file));

const sourceSrc = computed(() => githubTreeSrc(props.name));

const previewHeight = computed(() => props.height ?? example.value.height);

const uid = useId();

const active = ref<Mode>('preview');

const supported = ref(true);

// First StackBlitz selection boots the iframe; v-show keeps it alive after.
const stackblitzBooted = ref(false);

// StackBlitz is strictly opt-in: every instance starts on the static preview,
// and WebContainers only boot on an explicit tab click.
function selectTab(mode: Mode) {
  active.value = mode;

  if (mode === 'stackblitz' && supported.value) stackblitzBooted.value = true;
}

onMounted(() => {
  supported.value = webContainersSupported();
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
      <div class="live-example-links">
        <a
          class="source-link"
          :href="sourceSrc"
          target="_blank"
          rel="noopener"
          :aria-label="`${example.title} source on GitHub`"
          title="Source on GitHub"
        >
          <VPIcon icon="simple-icons:github" aria-hidden="true" />
        </a>
        <a class="open-badge" :href="openSrc" target="_blank" rel="noopener">
          <img
            alt="Open in StackBlitz"
            src="https://developer.stackblitz.com/img/open_in_stackblitz.svg"
            width="162"
            height="32"
          />
        </a>
      </div>
    </div>
    <div
      class="live-example-panels"
      :class="{ collapsed: active === 'stackblitz' }"
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
  margin-block: var(--lur-space-4);
}

.live-example-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  /* Links sit at the end of a shared row and at the start once wrapped. */
  justify-content: space-between;
  gap: var(--lur-space-3);
  margin-block-end: var(--lur-space-2);
}

.live-example-tablist {
  display: inline-flex;
  gap: var(--lur-space-1);
  padding: var(--lur-inset-control);
  background: var(--vp-c-bg-soft);
  border: var(--lur-border-width) solid var(--vp-c-divider);
  border-radius: var(--lur-radius-control);
}

.tab {
  padding-block: var(--lur-space-1);
  padding-inline: var(--lur-space-3);
  font-size: var(--lur-text-sm);
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: transparent;
  border: 0;
  border-radius: var(--lur-radius-control-inner);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color var(--lur-duration-base) var(--ease-out),
    color var(--lur-duration-base) var(--ease-out),
    transform var(--lur-duration-fast) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .tab:hover {
    color: var(--vp-c-text-1);
  }
}

.tab:active {
  transform: scale(0.97);
}

.tab:focus-visible {
  outline: var(--lur-focus-ring-width) solid var(--vp-c-brand-1);
  outline-offset: var(--lur-focus-ring-offset);
}

.tab.active {
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
  box-shadow: 0 0 0 var(--lur-border-width) var(--vp-c-divider);
}

.live-example-links {
  display: flex;
  align-items: center;
  gap: var(--lur-space-2);
}

.open-badge,
.source-link {
  display: inline-flex;
  align-items: center;
  line-height: 0;
  border: var(--lur-border-width) solid var(--vp-c-divider);
  border-radius: var(--lur-radius-control);
  overflow: clip;
  transition: border-color var(--lur-duration-base) var(--ease-out);
}

.source-link {
  justify-content: center;
  inline-size: var(--example-control-size);
  block-size: var(--example-control-size);
  color: var(--vp-c-text-1);
  font-size: var(--lur-icon-sm);
  background: var(--vp-c-bg-soft);
}

.source-link:focus-visible {
  outline: var(--lur-focus-ring-width) solid var(--vp-c-brand-1);
  outline-offset: var(--lur-focus-ring-offset);
}

@media (hover: hover) and (pointer: fine) {
  .open-badge:hover,
  .source-link:hover {
    border-color: var(--vp-c-brand-1);
  }
}

.open-badge img {
  display: block;
  height: calc(var(--example-control-size) - 2 * var(--lur-border-width));
  /* The width/height attributes give the ratio before the badge loads. */
  width: auto;
  /* .vp-doc gives content imgs 16px vertical margin — kill the gap. */
  margin: 0;
}

/* Reserve the preview pane's frame and action row so its iframe loading in
   doesn't shift the page. */
.live-example-panels {
  min-height: calc(
    min(var(--embed-height, 420px), var(--example-frame-max-height)) +
      var(--example-actions-gap) + var(--example-control-size)
  );
}

/* The StackBlitz pane sizes itself — the editor keeps its own aspect ratio
   and the unsupported fallback is a short note — so drop the preview
   reservation whenever that tab is active. */
.live-example-panels.collapsed {
  min-height: 0;
}

.fallback-note {
  padding-block: var(--lur-space-2);
  padding-inline: var(--lur-space-3);
  font-size: var(--lur-text-sm);
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: var(--lur-border-width) solid var(--vp-c-divider);
  border-radius: var(--lur-radius-control);
}

.fallback-note p {
  margin: 0;
}
</style>
