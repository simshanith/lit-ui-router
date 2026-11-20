<script setup lang="ts">
import { useData } from 'vitepress';

const { frontmatter } = useData();
</script>

<template>
  <div v-if="frontmatter.positioning" class="home-positioning">
    <div class="container">
      <!-- positioning is an authored frontmatter string in index.md, not user input -->
      <p class="copy" v-html="frontmatter.positioning"></p>
    </div>
  </div>
</template>

<style scoped>
.home-positioning {
  padding-inline: 1.5rem;
  margin-block-end: var(--site-space-6);
}

@media (min-width: 40rem) {
  .home-positioning {
    padding-inline: 3rem;
    margin-block-end: var(--site-space-8);
  }
}

@media (min-width: 60rem) {
  .home-positioning {
    padding-inline: 4rem;
  }
}

.container {
  margin-inline: auto;
  max-inline-size: 72rem;
}

.copy {
  margin: 0;
  max-inline-size: 68ch;
  font-size: var(--site-text-md);
  line-height: 1.6;
  color: var(--site-color-text-muted);
  text-wrap: pretty;
}

.copy :deep(code) {
  font-family: var(--vp-font-family-mono);
  font-size: 0.9em;
  color: var(--site-color-text);
  background: var(--vp-code-bg);
  padding: 0.1em 0.35em;
  border-radius: var(--site-radius-control-inner);
}

.copy :deep(a) {
  font-weight: 500;
  color: var(--site-color-interaction);
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  transition: color var(--site-duration-base) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .copy :deep(a:hover) {
    color: var(--site-color-interaction-hover);
  }
}

.copy :deep(a:focus-visible) {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
  border-radius: var(--site-radius-control-inner);
}

.copy :deep(a > code) {
  color: inherit;
}
</style>
