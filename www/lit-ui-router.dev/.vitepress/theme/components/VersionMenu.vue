<script setup lang="ts">
import { useData } from 'vitepress';
import VPNavMenuGroup from 'vitepress/dist/client/theme-default/components/VPNavMenuGroup.vue';
import { computed, onMounted, shallowRef } from 'vue';

import { menuVersions, sameVersionPage, SITE_ORIGIN } from '../../versions.ts';
import { goToVersionPage, isPlainClick, useVersions } from '../use-versions.ts';

const { screenMenu, menu } = defineProps<{
  screenMenu?: boolean;
  menu?: boolean;
}>();

const { page } = useData();

const { manifest, version } = useVersions();

// Absolute, so VitePress doesn't prefix this build's base; SSR can't know the host.
const origin = shallowRef(SITE_ORIGIN);

onMounted(() => {
  origin.value = location.origin;
});

const entries = computed(() =>
  menuVersions(manifest.value).map((target) => ({
    target,
    link: new URL(
      sameVersionPage(
        target,
        page.value.relativePath,
        page.value.isNotFound ?? false,
      ),
      origin.value,
    ).href,
  })),
);

const label = computed(
  () => version.value?.label ?? manifest.value.current.label,
);

// A listed group (mobile screen, overflow menu) needs the context the bar's flyout gets from its place.
const item = computed(() => ({
  text: screenMenu || menu ? `Version: ${label.value}` : label.value,
  items: entries.value.map(({ target, link }) => ({
    text: target.label,
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
  void goToVersionPage(anchor.href, entry.target.path);
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
