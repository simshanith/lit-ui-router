<script setup lang="ts">
import { activeId, markFor, type FrameworkEntry } from './frameworks';

const props = defineProps<{ entry: FrameworkEntry }>();

const mark = markFor(props.entry);

function toggle() {
  activeId.value = activeId.value === props.entry.id ? null : props.entry.id;
}
</script>

<template>
  <article
    class="framework-card"
    :class="{
      active: activeId === entry.id,
      dimmed: activeId !== null && activeId !== entry.id,
    }"
    data-fw-toggle
    @click="toggle"
  >
    <span class="mark">
      <img
        class="mark-light"
        :src="mark.light"
        :alt="`${entry.name} logo`"
        :style="{ height: `${mark.height}px` }"
      />
      <img
        class="mark-dark"
        :src="mark.dark"
        :alt="`${entry.name} logo`"
        :style="{ height: `${mark.height}px` }"
      />
    </span>
    <strong class="name">{{ entry.name }}</strong>
    <!-- blurbs are authored strings from frameworks.ts, not user input -->
    <p class="blurb" v-html="entry.blurb"></p>
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
    box-shadow 0.15s ease,
    opacity 0.15s ease;
}

.framework-card.active {
  border-color: var(--vp-c-brand-1);
  box-shadow: var(--vp-shadow-2);
}

.framework-card.dimmed {
  opacity: 0.6;
}

/* cosmetic lift only — linked highlighting is click-intent */
@media (hover: hover) {
  .framework-card:hover {
    transform: translateY(-2px);
  }
}

.framework-card {
  cursor: pointer;
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
  height: 40px;
}

/* no display on .mark img: it would out-specify the per-theme hiding below */
.mark img {
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
