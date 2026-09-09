<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import {
  activeId,
  ambientMarks,
  frameworks,
  levels,
  markFor,
} from './frameworks';

// featured entries lead: first chip in a shared band, first legend row
const ordered = [...frameworks].sort(
  (a, b) => Number(b.featured ?? false) - Number(a.featured ?? false),
);

const pointsAt = (level: number) =>
  ordered.flatMap((f) =>
    f.points
      .filter((p) => p.level === level)
      .map((p) => ({ entry: f, point: p })),
  );

// click-intent only: one writer for the shared state. Hover/focus handlers
// were racing the click toggle (enter/focus set the id the click then
// un-toggled), which read as a broken, long-press-only legend.
function toggle(id: string) {
  activeId.value = activeId.value === id ? null : id;
}

function clearOnOutsideClick(e: MouseEvent) {
  if (!(e.target as Element | null)?.closest?.('[data-fw-toggle]')) {
    activeId.value = null;
  }
}

function clearOnEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') activeId.value = null;
}

onMounted(() => {
  document.addEventListener('click', clearOnOutsideClick);
  document.addEventListener('keydown', clearOnEscape);
});

onUnmounted(() => {
  document.removeEventListener('click', clearOnOutsideClick);
  document.removeEventListener('keydown', clearOnEscape);
  activeId.value = null;
});

function stateClass(id: string) {
  return {
    active: activeId.value === id,
    dimmed: activeId.value !== null && activeId.value !== id,
  };
}
</script>

<template>
  <figure
    class="framework-spectrum"
    aria-label="Where the ecosystem lands on the server-support spectrum, level 0 (memory) through level 5 (full-stack); each point is a tool's documented position, detailed by the cards below"
  >
    <div class="bands" role="presentation">
      <div v-for="level in levels" :key="level.n" class="band">
        <span class="band-label">
          <span class="band-n">{{ level.n }}</span>
          {{ level.name }}
        </span>
        <span class="band-points">
          <button
            v-for="{ entry, point } in pointsAt(level.n)"
            :key="`${entry.id}-${point.label}`"
            type="button"
            class="point"
            :class="[stateClass(entry.id), { featured: entry.featured }]"
            data-fw-toggle
            :aria-label="`${entry.name} — ${point.label} (level ${level.n})`"
            :title="`${entry.name} — ${point.label}`"
            :aria-pressed="activeId === entry.id"
            @click="toggle(entry.id)"
          >
            <img :src="markFor(entry).light" class="mark-light" alt="" />
            <img :src="markFor(entry).dark" class="mark-dark" alt="" />
          </button>
        </span>
        <!-- ambient environment marks: where these modes run, not tools on
             the spectrum — muted, non-interactive, no cards or legend rows -->
        <span v-if="ambientMarks[level.n]" class="ambient" aria-hidden="true">
          <svg
            v-for="a in ambientMarks[level.n]"
            :key="a.name"
            class="ambient-mark"
            viewBox="0 0 24 24"
          >
            <title>{{ a.name }}</title>
            <path :d="a.d" fill="currentColor" />
          </svg>
        </span>
      </div>
    </div>
    <figcaption class="axis-caption">
      what the app asks of its server →
    </figcaption>
    <ul class="legend">
      <li v-for="f in ordered" :key="f.id" :class="{ featured: f.featured }">
        <button
          type="button"
          class="legend-entry"
          :class="[stateClass(f.id), { featured: f.featured }]"
          data-fw-toggle
          :aria-pressed="activeId === f.id"
          @click="toggle(f.id)"
        >
          <span class="legend-mark">
            <img :src="markFor(f).light" class="mark-light" alt="" />
            <img :src="markFor(f).dark" class="mark-dark" alt="" />
          </span>
          {{ f.name }}
        </button>
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.framework-spectrum {
  margin: 20px 0 8px;
}

.bands {
  position: relative;
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

/* the no-server zone: bands 0-1 sit on a darker ground that dissolves into
   band 2, where the server enters the story */
.bands::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 45%;
  background: linear-gradient(
    to right,
    rgb(0 0 0 / 0.05) 0%,
    rgb(0 0 0 / 0.05) 72%,
    transparent 100%
  );
  pointer-events: none;
}

.dark .bands::before {
  background: linear-gradient(
    to right,
    rgb(0 0 0 / 0.22) 0%,
    rgb(0 0 0 / 0.22) 72%,
    transparent 100%
  );
}

.band {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 120px;
  padding: 8px 6px;
}

.band + .band {
  border-left: 1px solid var(--vp-c-divider);
}

.band-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  line-height: 1.2;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

.band-n {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  font-size: 10px;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
}

.band-points {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-content: flex-start;
}

/* a point is a 28px hit target around a ~16px mark */
.point {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 50%;
  background: var(--vp-c-bg);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    opacity 0.15s ease,
    transform 0.15s ease;
}

.point img {
  max-width: 18px;
  max-height: 16px;
  width: auto;
  height: auto;
}

/* this stack's own points wear the brand ring at rest… */
.point.featured {
  border-color: var(--vp-c-brand-1);
}

.point.active {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 1px var(--vp-c-brand-1);
  transform: translateY(-1px);
}

/* …and active still reads stronger */
.point.featured.active {
  box-shadow: 0 0 0 2px var(--vp-c-brand-1);
}

.point:focus-visible,
.legend-entry:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 1px;
}

.ambient {
  display: flex;
  gap: 6px;
  margin-top: auto;
  color: var(--vp-c-text-3);
  opacity: 0.55;
}

.ambient-mark {
  width: 14px;
  height: 14px;
}

.axis-caption {
  margin-top: 6px;
  font-size: 11px;
  color: var(--vp-c-text-3);
  text-align: right;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-width: 320px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.legend li {
  margin: 0;
}

.legend-entry {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: none;
  font-size: 12.5px;
  text-align: left;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    opacity 0.15s ease;
}

.legend li.featured {
  margin-bottom: 6px;
}

.legend-entry.featured {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
}

.legend-entry.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  box-shadow: 0 0 0 1px var(--vp-c-brand-1);
}

.legend-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
}

.legend-mark img {
  max-width: 16px;
  max-height: 14px;
  width: auto;
  height: auto;
}

.point.dimmed,
.legend-entry.dimmed {
  opacity: 0.45;
}

.mark-dark,
.dark .mark-light {
  display: none;
}

.dark .mark-dark {
  display: inline;
}

@media (prefers-reduced-motion: reduce) {
  .point,
  .legend-entry {
    transition: none;
  }

  .point.active {
    transform: none;
  }
}

@media (max-width: 640px) {
  .bands {
    grid-template-columns: repeat(3, 1fr);
  }

  /* 3-col layout: the no-server zone is the top row's first two bands */
  .bands::before {
    width: 100%;
    inset: 0 0 auto 0;
    height: 50%;
    background: linear-gradient(
      to right,
      rgb(0 0 0 / 0.05) 0%,
      rgb(0 0 0 / 0.05) 60%,
      transparent 80%
    );
  }

  .dark .bands::before {
    background: linear-gradient(
      to right,
      rgb(0 0 0 / 0.22) 0%,
      rgb(0 0 0 / 0.22) 60%,
      transparent 80%
    );
  }

  .band:nth-child(4) {
    border-left: none;
  }

  .band:nth-child(n + 4) {
    border-top: 1px solid var(--vp-c-divider);
  }

  .band {
    min-height: 88px;
  }
}
</style>
