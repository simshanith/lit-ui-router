import { useData } from 'vitepress';
import { computed, onMounted, shallowRef } from 'vue';

import {
  BUNDLED_MANIFEST,
  fetchManifest,
  versionOf,
  type VersionManifest,
} from '../versions.ts';

const manifest = shallowRef<VersionManifest>(BUNDLED_MANIFEST);

let refresh: Promise<void> | undefined;

/** The version manifest, bundled first and then the live `/versions.json`, and the version this build serves. */
export function useVersions() {
  const { site } = useData();

  onMounted(() => {
    refresh ??= fetchManifest().then((live) => {
      if (live) manifest.value = live;
    });
  });

  return {
    manifest,
    version: computed(() => versionOf(manifest.value, site.value.base)),
  };
}

/** Each version is its own VitePress app: load the same page there when it exists, else that version's home. */
export async function goToVersionPage(href: string, home: string) {
  const response = await fetch(href, { method: 'HEAD' }).catch(() => null);
  location.assign(response?.ok ? href : home);
}

/** True for a plain primary click the page may take over. */
export function isPlainClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}
