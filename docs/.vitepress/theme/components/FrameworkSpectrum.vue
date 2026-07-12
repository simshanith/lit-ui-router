<script setup lang="ts">
import { activeId, frameworks, levels, markFor } from './frameworks';

const pointsAt = (level: number) =>
  frameworks.flatMap((f) =>
    f.points
      .filter((p) => p.level === level)
      .map((p) => ({ entry: f, point: p })),
  );

function toggle(id: string) {
  activeId.value = activeId.value === id ? null : id;
}

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
            :class="stateClass(entry.id)"
            :aria-label="`${entry.name} — ${point.label} (level ${level.n})`"
            :title="`${entry.name} — ${point.label}`"
            :aria-pressed="activeId === entry.id"
            @mouseenter="activeId = entry.id"
            @mouseleave="activeId = null"
            @focus="activeId = entry.id"
            @blur="activeId = null"
            @click="toggle(entry.id)"
          >
            <img :src="markFor(entry).light" class="mark-light" alt="" />
            <img :src="markFor(entry).dark" class="mark-dark" alt="" />
          </button>
        </span>
      </div>
    </div>
    <figcaption class="axis-caption">
      what the app asks of its server →
    </figcaption>
    <ul class="legend">
      <li v-for="f in frameworks" :key="f.id">
        <button
          type="button"
          class="legend-entry"
          :class="stateClass(f.id)"
          :aria-pressed="activeId === f.id"
          @mouseenter="activeId = f.id"
          @mouseleave="activeId = null"
          @focus="activeId = f.id"
          @blur="activeId = null"
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
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.band {
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

.point.active {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 1px var(--vp-c-brand-1);
  transform: translateY(-1px);
}

.axis-caption {
  margin-top: 6px;
  font-size: 11px;
  color: var(--vp-c-text-3);
  text-align: right;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.legend li {
  margin: 0;
}

.legend-entry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  font-size: 12.5px;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    opacity 0.15s ease;
}

.legend-entry.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
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
