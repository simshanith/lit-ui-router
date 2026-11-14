<script setup lang="ts">
import { useData } from 'vitepress';
import {
  computed,
  onBeforeUnmount,
  onMounted,
  useTemplateRef,
  watchEffect,
} from 'vue';

import { bannerKind, sameVersionPage } from '../../versions.ts';
import { goToVersionPage, isPlainClick, useVersions } from '../use-versions.ts';

const { page } = useData();

const { manifest, version } = useVersions();

const kind = computed(() => bannerKind(manifest.value, version.value));

const current = computed(() => manifest.value.current);

const href = computed(() =>
  sameVersionPage(
    current.value,
    page.value.relativePath,
    page.value.isNotFound ?? false,
  ),
);

const el = useTemplateRef('el');

let observer: ResizeObserver | undefined;

// CSS sets the one-line offset for first paint; this corrects it when the banner wraps.
onMounted(() =>
  watchEffect(() => {
    observer?.disconnect();
    const banner = el.value;
    const root = document.documentElement.style;

    if (!banner) return root.removeProperty('--vp-layout-top-height');
    observer = new ResizeObserver(() =>
      root.setProperty('--vp-layout-top-height', `${banner.offsetHeight}px`),
    );
    observer.observe(banner);
  }),
);

onBeforeUnmount(() => {
  observer?.disconnect();
  document.documentElement.style.removeProperty('--vp-layout-top-height');
});

function onClick(event: MouseEvent) {
  if (!isPlainClick(event)) return;
  event.preventDefault();
  void goToVersionPage(href.value, current.value.path);
}
</script>

<template>
  <div
    v-if="kind !== 'none' && version"
    ref="el"
    class="VersionBanner"
    role="note"
    aria-label="Docs version"
  >
    <p v-if="kind === 'unreleased'">
      Unreleased docs from {{ version.label }}.
      <a :href target="_self" @click="onClick">Go to released</a>
    </p>
    <p v-else-if="kind === 'deprecated'">
      {{ version.label }} is no longer supported.
      <a :href target="_self" @click="onClick">Go to latest</a>
    </p>
    <p v-else>
      You're reading the {{ version.label }} docs.
      <a :href target="_self" @click="onClick">Go to latest</a>
    </p>
  </div>
</template>

<style>
:root:has(.VersionBanner) {
  --vp-layout-top-height: calc(
    var(--site-text-sm) * 1.5 + 2 * var(--site-space-2) +
      var(--site-border-width)
  );
}
</style>

<style scoped>
.VersionBanner {
  position: fixed;
  inset-block-start: 0;
  inset-inline: 0;
  z-index: var(--vp-z-index-layout-top);
  padding: var(--site-space-2) var(--site-space-4);
  border-block-end: var(--site-border-width) solid var(--site-color-line);
  background-color: var(--site-color-surface-soft);
  color: var(--site-color-text);
  font-size: var(--site-text-sm);
  line-height: 1.5;
  text-align: center;
}

.VersionBanner p {
  margin: 0;
}

.VersionBanner a {
  color: var(--site-color-interaction);
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .VersionBanner a:hover {
    color: var(--site-color-interaction-hover);
  }
}

.VersionBanner a:focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
}
</style>
