<script setup lang="ts">
// The pager is a <footer>, a second contentinfo landmark beside the site footer; vite.config.ts aliases VPDoc's import here.
import VPDocFooter from 'vitepress/dist/client/theme-default/components/VPDocFooter.vue';
</script>

<template>
  <VPDocFooter role="none">
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name" />
    </template>
  </VPDocFooter>
</template>
