<script setup lang="ts">
import { useData } from 'vitepress';
import VPNavMenuGroup from 'vitepress/dist/client/theme-default/components/VPNavMenuGroup.vue';
import { computed, onMounted, shallowRef } from 'vue';

import { versionMenu } from '../../lines.ts';
import { pagePath, SITE_ORIGIN } from '../../versions.ts';
import { goToVersionPage, isPlainClick, useVersions } from '../use-versions.ts';

const { screenMenu, menu } = defineProps<{
  screenMenu?: boolean;
  menu?: boolean;
}>();

const { page, site } = useData();

const { manifest } = useVersions();

// Absolute, so VitePress doesn't prefix this build's base; SSR can't know the host.
const origin = shallowRef(SITE_ORIGIN);

onMounted(() => {
  origin.value = location.origin;
});

// From the page source, not the address bar, so the server and the client render the same entries.
const state = computed(() =>
  versionMenu(
    manifest.value,
    `${site.value.base}${pagePath(page.value.relativePath)}`,
    page.value.isNotFound ?? false,
  ),
);

const entries = computed(() =>
  state.value.entries.map(({ label, href, fallback }) => ({
    label,
    fallback,
    link: new URL(href, origin.value).href,
  })),
);

// A listed group (mobile screen, overflow menu) needs the context the bar's flyout gets from its place.
const item = computed(() => ({
  text:
    screenMenu || menu ? `Version: ${state.value.label}` : state.value.label,
  items: entries.value.map(({ label, link }) => ({
    text: label,
    link,
    target: '_self',
    noIcon: true,
  })),
}));

function onClick(event: MouseEvent) {
  if (!isPlainClick(event) || !(event.target instanceof Element)) return;
  const anchor = event.target.closest('a');
  const entry = entries.value.find(({ link }) => link === anchor?.href);

  if (!anchor || !entry) return;

  event.preventDefault();
  void goToVersionPage(anchor.href, entry.fallback);
}
</script>

<template>
  <VPNavMenuGroup
    v-if="entries.length > 1"
    class="VersionMenu"
    :item
    :screen="screenMenu"
    :menu
    @click="onClick"
  />
</template>
