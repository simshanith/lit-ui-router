<script setup lang="ts">
import { brandMarks, type Brand } from './brands';

const props = defineProps<{
  href?: string;
  brand: Brand;
}>();

const mark = brandMarks[props.brand];
</script>

<template>
  <span class="brand-link">
    <a v-if="href" :href="href" target="_blank" rel="noreferrer"><slot /></a>
    <span v-else class="brand-term" tabindex="0"><slot /></span>
    <span class="brand-card" aria-hidden="true">
      <img class="mark-light" :src="mark.light" alt="" />
      <img class="mark-dark" :src="mark.dark" alt="" />
    </span>
  </span>
</template>

<style scoped>
.brand-link {
  position: relative;
}

.brand-term {
  cursor: help;
  text-decoration: underline dotted var(--vp-c-text-3);
  text-underline-offset: 3px;
}

.brand-card {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  z-index: 30;
  display: inline-flex;
  padding: 8px 14px;
  background: var(--vp-c-bg-elv);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  box-shadow: var(--vp-shadow-2);
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, 4px);
  transition:
    opacity 0.15s ease,
    transform 0.15s ease,
    visibility 0.15s;
  pointer-events: none;
}

.brand-card img {
  display: block;
  height: 26px;
  width: auto;
}

.mark-dark,
.dark .mark-light {
  display: none;
}

.dark .mark-dark {
  display: block;
}

/* hover only where hover exists (no touch trap); focus keeps it keyboard-reachable */
@media (hover: hover) {
  .brand-link:hover .brand-card {
    opacity: 1;
    visibility: visible;
    transform: translate(-50%, 0);
  }
}

.brand-link:focus-within .brand-card {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, 0);
}

@media (prefers-reduced-motion: reduce) {
  .brand-card {
    transition: none;
  }
}
</style>
