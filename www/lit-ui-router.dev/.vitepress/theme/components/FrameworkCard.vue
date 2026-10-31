<script setup lang="ts">
import { activeId, markFor, type FrameworkEntry } from './frameworks';

const props = defineProps<{ entry: FrameworkEntry }>();

const mark = markFor(props.entry);

function toggle() {
  activeId.value = activeId.value === props.entry.id ? null : props.entry.id;
}
</script>

<template>
  <!-- A real button, like the spectrum's points and legend rows: focus,
       Enter/Space and the pressed state come free. Its content is phrasing
       only (the blurbs carry <code> and nothing else), so the card reads as
       one control whose name is the framework name plus its blurb. -->
  <button
    type="button"
    class="framework-card"
    :class="{
      active: activeId === entry.id,
      dimmed: activeId !== null && activeId !== entry.id,
    }"
    data-fw-toggle
    :aria-pressed="activeId === entry.id"
    @click="toggle"
  >
    <!-- decorative: the name follows in the button's own text -->
    <span class="mark">
      <img
        class="mark-light"
        :src="mark.light"
        alt=""
        :style="{ height: `${mark.height}px` }"
      />
      <img
        class="mark-dark"
        :src="mark.dark"
        alt=""
        :style="{ height: `${mark.height}px` }"
      />
    </span>
    <strong class="name">{{ entry.name }}</strong>
    <!-- blurbs are authored strings from frameworks.ts, not user input -->
    <span class="blurb" v-html="entry.blurb"></span>
  </button>
</template>

<style scoped>
.framework-card {
  display: flex;
  flex-direction: column;
  gap: var(--lur-space-2);
  width: 100%;
  padding: var(--lur-space-4);
  /* the button reset: the card owns its own type and alignment */
  font: inherit;
  text-align: start;
  color: inherit;
  background: var(--vp-c-bg-soft);
  border: var(--lur-border-width) solid var(--vp-c-divider);
  border-radius: var(--lur-radius-card);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    transform var(--lur-duration-fast) var(--ease-out),
    border-color var(--lur-duration-fast) var(--ease-out),
    box-shadow var(--lur-duration-fast) var(--ease-out),
    opacity var(--lur-duration-fast) var(--ease-out);
}

.framework-card.active {
  border-color: var(--vp-c-brand-1);
  box-shadow: var(--vp-shadow-2);
}

.framework-card.dimmed {
  opacity: 0.6;
}

.framework-card:focus-visible {
  outline: var(--lur-focus-ring-width) solid var(--vp-c-brand-1);
  outline-offset: var(--lur-focus-ring-offset);
}

/* cosmetic lift only — linked highlighting is click-intent */
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .framework-card:hover {
    transform: translateY(calc(-1 * var(--lur-space-0-5)));
  }
}

.framework-card:active {
  transform: scale(0.98);
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
  font-size: var(--lur-text-md);
  color: var(--vp-c-text-1);
}

.blurb {
  display: block;
  margin: 0;
  font-size: var(--lur-text-sm);
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.blurb :deep(code) {
  font-size: var(--lur-text-xs);
}
</style>
