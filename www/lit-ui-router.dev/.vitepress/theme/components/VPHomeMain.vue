<script setup lang="ts">
// The home layout renders no <main>; vite.config.ts aliases VPContent's import here.
import VPHome from 'vitepress/dist/client/theme-default/components/VPHome.vue';
</script>

<template>
  <main>
    <VPHome>
      <template v-for="(_, name) in $slots" #[name]>
        <slot :name="name" />
      </template>
    </VPHome>
  </main>
</template>
