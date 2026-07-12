<script setup lang="ts">
import { brandMarks, type Brand } from './brands';

const props = defineProps<{
  name: string;
  brand: Brand;
}>();

const mark = brandMarks[props.brand];
</script>

<template>
  <article class="framework-card">
    <span class="mark">
      <img class="mark-light" :src="mark.light" :alt="`${name} logo`" />
      <img class="mark-dark" :src="mark.dark" :alt="`${name} logo`" />
    </span>
    <strong class="name">{{ name }}</strong>
    <p class="blurb"><slot /></p>
  </article>
</template>

<style scoped>
.framework-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

@media (hover: hover) {
  .framework-card:hover {
    transform: translateY(-2px);
    border-color: var(--vp-c-brand-1);
    box-shadow: var(--vp-shadow-2);
  }
}

@media (prefers-reduced-motion: reduce) {
  .framework-card {
    transition: none;
  }

  .framework-card:hover {
    transform: none;
  }
}

.mark {
  display: flex;
  align-items: center;
  height: 36px;
}

.mark img {
  display: block;
  max-height: 30px;
  max-width: 128px;
  width: auto;
}

.mark-dark,
.dark .mark-light {
  display: none;
}

.dark .mark-dark {
  display: block;
}

.name {
  font-size: 15px;
  color: var(--vp-c-text-1);
}

.blurb {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.blurb :deep(code) {
  font-size: 12px;
}
</style>
