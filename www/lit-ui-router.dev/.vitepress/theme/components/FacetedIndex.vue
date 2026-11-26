<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { withBase } from 'vitepress';

import { data as bundles } from './faceted-index.data';
import {
  activeFacetsOf,
  addFacetRow,
  clearConflictingFilters,
  decodeHashSlug,
  facetCounts,
  facetValuesOf,
  initialVisibleFacets,
  matchesFilter,
  orderedPickerFacets,
  parseQueryFilter,
  relaxations,
  removeFacetRow,
  serializeQueryFilter,
  splitInlineCode,
  toggleFacetValue,
  type FacetDefinition,
  type FacetEntry,
  type FacetFilter,
  type FacetLink,
} from './faceted-index';

const props = defineProps<{
  index: 'examples' | 'packages';
}>();

const dataset = computed(() => bundles[props.index]);

const activeFacets = computed(() =>
  activeFacetsOf(dataset.value.facets, dataset.value.entries),
);

const pickerFacets = computed(() =>
  orderedPickerFacets(activeFacets.value, dataset.value.pickerOrder),
);

const rowFacets = computed(() =>
  activeFacets.value.filter((facet) => facet.showOnRow !== false),
);

const facetByKey = computed(
  () => new Map(activeFacets.value.map((facet) => [facet.key, facet])),
);

const filter = ref<FacetFilter>(new Map());

const visibleKeys = ref<string[]>(
  initialVisibleFacets(
    dataset.value.defaultFacet,
    new Map(),
    activeFacets.value,
  ),
);

// Empty until user interaction changes the result count (matching HomeSeeItRun.vue).
const announcement = ref('');

const visibleFacets = computed<FacetDefinition[]>(() =>
  visibleKeys.value.flatMap((key) => {
    const found = facetByKey.value.get(key);

    return found ? [found] : [];
  }),
);

const addableFacets = computed(() =>
  pickerFacets.value.filter((facet) => !visibleKeys.value.includes(facet.key)),
);

const activePairs = computed(() =>
  activeFacets.value.flatMap(({ key }) => {
    const value = filter.value.get(key);

    return value ? [{ key, value }] : [];
  }),
);

const matchedEntries = computed(() =>
  dataset.value.entries.filter((entry) => matchesFilter(entry, filter.value)),
);

const visibleGroups = computed(() =>
  dataset.value.groups
    .map((group) => ({
      ...group,
      entries: matchedEntries.value.filter((entry) => entry.group === group.id),
    }))
    .filter((group) => group.entries.length > 0),
);

const emptyRelaxations = computed(() =>
  matchedEntries.value.length === 0
    ? relaxations(dataset.value.entries, filter.value, activeFacets.value)
    : [],
);

function syncUrl(): void {
  if (typeof window === 'undefined') return;

  const query = serializeQueryFilter(filter.value, activeFacets.value);
  const next = `${window.location.pathname}${query}${window.location.hash}`;

  window.history.replaceState(window.history.state, '', next);
}

function announce(): void {
  const count = matchedEntries.value.length;
  const total = dataset.value.entries.length;

  const noun =
    count === 1 ? dataset.value.itemSingular : dataset.value.itemPlural;

  announcement.value = `Showing ${count} of ${total} ${noun}.`;
}

function setFilter(next: FacetFilter): void {
  filter.value = next;
  syncUrl();
  announce();
}

function onTogglePill(key: string, value: string): void {
  setFilter(toggleFacetValue(filter.value, key, value));
}

function onEntryFacetClick(key: string, value: string): void {
  visibleKeys.value = addFacetRow(visibleKeys.value, key);
  setFilter(toggleFacetValue(filter.value, key, value));
}

function onAddFacet(event: Event): void {
  const select = event.currentTarget;

  if (!(select instanceof HTMLSelectElement) || !select.value) return;

  visibleKeys.value = addFacetRow(visibleKeys.value, select.value);
  select.value = '';
}

function onRemoveFacet(key: string): void {
  const hadValue = filter.value.has(key);
  const next = removeFacetRow(visibleKeys.value, filter.value, key);

  visibleKeys.value = next.visible;
  filter.value = next.filter;

  if (hadValue) {
    syncUrl();
    announce();
  }
}

function onReset(): void {
  setFilter(new Map());
}

function countsFor(facet: FacetDefinition) {
  return facetCounts(dataset.value.entries, facet, filter.value);
}

function isSignalValue(facet: FacetDefinition, value: string): boolean {
  return facet.defaultValue !== undefined && value !== facet.defaultValue;
}

function rowPillsFor(entry: FacetEntry) {
  return rowFacets.value.flatMap((facet) =>
    facetValuesOf(entry, facet.key).map((value) => ({
      key: facet.key,
      value,
      signal: isSignalValue(facet, value),
      active: filter.value.get(facet.key) === value,
    })),
  );
}

function linkHref(link: FacetLink): string {
  return link.href.startsWith('/') ? withBase(link.href) : link.href;
}

function revealHashTarget(): void {
  if (typeof window === 'undefined' || !window.location.hash) return;

  const slug = decodeHashSlug(window.location.hash);
  const entry = dataset.value.entries.find((item) => item.slug === slug);

  if (!entry || matchesFilter(entry, filter.value)) return;

  filter.value = clearConflictingFilters(entry, filter.value);
  syncUrl();
  void nextTick(() => {
    document.getElementById(slug)?.scrollIntoView();
  });
}

function syncFromLocation(): void {
  const parsed = parseQueryFilter(window.location.search, activeFacets.value);

  filter.value = parsed;
  visibleKeys.value = initialVisibleFacets(
    dataset.value.defaultFacet,
    parsed,
    activeFacets.value,
  );
  revealHashTarget();
}

onMounted(() => {
  syncFromLocation();
  window.addEventListener('popstate', syncFromLocation);
  window.addEventListener('hashchange', revealHashTarget);
});

onBeforeUnmount(() => {
  window.removeEventListener('popstate', syncFromLocation);
  window.removeEventListener('hashchange', revealHashTarget);
});
</script>

<template>
  <div class="faceted-index">
    <section class="facet-panel" :aria-label="`Filter ${dataset.itemPlural}`">
      <div v-if="visibleFacets.length > 0" class="facet-rows">
        <div
          v-for="facet in visibleFacets"
          :key="facet.key"
          class="facet-row"
          role="group"
          :aria-label="facet.key"
        >
          <span class="facet-key">{{ facet.key }}</span>
          <div class="facet-chips">
            <button
              type="button"
              class="chip chip-all"
              :aria-pressed="!filter.has(facet.key)"
              @click="onTogglePill(facet.key, '')"
            >
              <span>all</span>
              <span class="chip-count">{{ countsFor(facet).all }}</span>
            </button>
            <button
              v-for="item in countsFor(facet).values"
              :key="item.value"
              type="button"
              class="chip"
              :class="{ zero: item.count === 0 }"
              :aria-pressed="filter.get(facet.key) === item.value"
              @click="onTogglePill(facet.key, item.value)"
            >
              <span>{{ item.value }}</span>
              <span class="chip-count">{{ item.count }}</span>
            </button>
          </div>
          <button
            type="button"
            class="row-remove"
            :aria-label="`Remove ${facet.key} facet row`"
            :title="`Remove ${facet.key} row`"
            @click="onRemoveFacet(facet.key)"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      </div>

      <div class="facet-panel-foot">
        <div class="add-facet-wrap">
          <label class="visually-hidden" :for="`add-facet-${index}`">
            Add a facet row
          </label>
          <select
            :id="`add-facet-${index}`"
            class="add-facet-select"
            :disabled="addableFacets.length === 0"
            @change="onAddFacet"
          >
            <option value="">
              {{
                addableFacets.length === 0
                  ? 'All facets shown'
                  : `+ Add facet (${addableFacets.length} left)…`
              }}
            </option>
            <option
              v-for="facet in addableFacets"
              :key="facet.key"
              :value="facet.key"
            >
              {{ facet.key }} — {{ facet.hint }}
            </option>
          </select>
          <svg
            class="add-facet-caret"
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>

        <div class="foot-right">
          <span class="result-count">
            Showing <strong>{{ matchedEntries.length }}</strong> of
            <strong>{{ dataset.entries.length }}</strong>
          </span>
          <button
            v-if="activePairs.length > 0"
            type="button"
            class="text-action"
            @click="onReset"
          >
            Reset
          </button>
        </div>
      </div>

      <details class="facet-glossary">
        <summary>What each facet means</summary>
        <dl class="glossary-list">
          <div
            v-for="facet in dataset.facets"
            :key="facet.key"
            class="glossary-item"
          >
            <dt>{{ facet.key }}</dt>
            <dd>
              <template
                v-for="(seg, idx) in splitInlineCode(facet.description)"
                :key="idx"
              >
                <code v-if="seg.code">{{ seg.text }}</code>
                <template v-else>{{ seg.text }}</template>
              </template>
            </dd>
          </div>
        </dl>
      </details>

      <p class="visually-hidden" role="status">{{ announcement }}</p>
    </section>

    <div v-if="matchedEntries.length === 0" class="empty-state">
      <h2 class="empty-title">
        No {{ dataset.itemPlural }} match
        <template v-for="(pair, i) in activePairs" :key="pair.key">
          <template v-if="i > 0"> and </template>
          <code>{{ pair.key }}={{ pair.value }}</code>
        </template>
      </h2>
      <p class="empty-copy">
        0 of {{ dataset.entries.length }} {{ dataset.itemPlural }} combine those
        facets. Switch a pill above or remove one constraint below.
      </p>
      <div class="empty-actions">
        <button
          v-for="drop in emptyRelaxations"
          :key="drop.key"
          type="button"
          class="site-button"
          @click="onTogglePill(drop.key, '')"
        >
          Drop <code>{{ drop.key }}={{ drop.value }}</code> · {{ drop.count }}
          {{ drop.count === 1 ? dataset.itemSingular : dataset.itemPlural }}
        </button>
        <button type="button" class="site-button primary" @click="onReset">
          Show all {{ dataset.entries.length }}
        </button>
      </div>
    </div>

    <section
      v-for="group in visibleGroups"
      :key="group.id"
      class="group-section"
      :aria-labelledby="`group-${index}-${group.id}`"
    >
      <h2 :id="`group-${index}-${group.id}`" class="group-heading">
        <span>{{ group.label }}</span>
        <span class="group-count">{{ group.entries.length }}</span>
      </h2>

      <ul class="entry-list">
        <li v-for="entry in group.entries" :key="entry.id" class="entry-row">
          <div class="entry-top">
            <h3
              :id="entry.slug"
              class="entry-title"
              :class="{ mono: entry.monoTitle }"
            >
              <span>{{ entry.title }}</span>
              <a
                class="entry-anchor"
                :href="`#${entry.slug}`"
                :aria-label="`Permalink to “${entry.title}”`"
                >#</a
              >
            </h3>
            <div class="entry-links">
              <a
                v-for="link in entry.links"
                :key="link.text"
                :href="linkHref(link)"
                :target="
                  link.self ? '_self' : link.external ? '_blank' : undefined
                "
                :rel="link.external ? 'noopener' : undefined"
              >
                {{ link.text }}
              </a>
            </div>
          </div>

          <p v-if="entry.summary" class="entry-summary">
            <template
              v-for="(seg, idx) in splitInlineCode(entry.summary)"
              :key="idx"
            >
              <code v-if="seg.code">{{ seg.text }}</code>
              <template v-else>{{ seg.text }}</template>
            </template>
          </p>

          <div class="entry-meta">
            <div class="row-facets" role="group" aria-label="Facets">
              <button
                v-for="pill in rowPillsFor(entry)"
                :key="`${pill.key}-${pill.value}`"
                type="button"
                class="row-facet"
                :class="{ signal: pill.signal, active: pill.active }"
                :aria-pressed="pill.active"
                :title="`Filter by ${pill.key}=${pill.value}`"
                @click="onEntryFacetClick(pill.key, pill.value)"
              >
                <span class="rk">{{ pill.key }}</span>
                <span class="rv">{{ pill.value }}</span>
              </button>
            </div>

            <span
              v-if="entry.embeddedIn && entry.embeddedIn.length > 0"
              class="entry-side"
            >
              In:
              <template v-for="(page, i) in entry.embeddedIn" :key="page.href">
                <template v-if="i > 0">, </template>
                <a :href="linkHref(page)">{{ page.text }}</a>
              </template>
            </span>

            <span
              v-else-if="entry.entryPoints && entry.entryPoints.length === 1"
              class="entry-side"
            >
              Entry: <code>{{ entry.entryPoints[0] }}</code>
            </span>

            <details
              v-else-if="entry.entryPoints && entry.entryPoints.length > 1"
              class="entry-side entrypoints-details"
            >
              <summary>
                {{ entry.entryPoints.length }} entry points (<code>{{
                  entry.entryPoints[0]
                }}</code
                >, …)
              </summary>
              <div class="entrypoints-list">
                <code v-for="ep in entry.entryPoints" :key="ep">{{ ep }}</code>
              </div>
            </details>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.faceted-index {
  margin-block: var(--site-space-5) var(--site-space-6);
}

.facet-panel {
  background: var(--site-color-surface-soft);
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-card);
  padding: var(--site-space-3) var(--site-space-4);
  margin-block-end: var(--site-space-5);
  display: grid;
  gap: var(--site-space-3);
}

.facet-rows {
  display: grid;
  gap: var(--site-space-2);
}

.facet-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--site-space-1) var(--site-space-2);
  align-items: center;
}

@media (min-width: 40rem) {
  .facet-row {
    grid-template-columns: 5rem minmax(0, 1fr) auto;
  }
}

.facet-key {
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-xs);
  font-weight: 600;
  color: var(--site-color-text);
}

.facet-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-1-5);
  grid-column: 1 / -1;
}

@media (min-width: 40rem) {
  .facet-chips {
    grid-column: auto;
  }
}

.row-remove {
  display: inline-grid;
  place-items: center;
  inline-size: 1.75rem;
  block-size: 1.75rem;
  padding: 0;
  font-size: 1rem;
  line-height: 1;
  color: var(--site-color-text-muted);
  background: transparent;
  border: var(--site-border-width) solid transparent;
  border-radius: var(--site-radius-control);
  cursor: pointer;
  touch-action: manipulation;
  grid-column: 2;
  grid-row: 1;
}

@media (min-width: 40rem) {
  .row-remove {
    grid-column: 3;
    grid-row: auto;
  }
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--site-space-1-5);
  min-block-size: 1.75rem;
  padding: var(--site-space-0-5) var(--site-space-3);
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-xs);
  line-height: 1.25;
  color: var(--site-color-text-muted);
  background: transparent;
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-pill);
  cursor: pointer;
  touch-action: manipulation;
}

.chip-count {
  font-variant-numeric: tabular-nums;
}

.chip.chip-all[aria-pressed='true'] {
  background: var(--site-color-surface);
  border-color: var(--site-color-text-muted);
  color: var(--site-color-text);
  font-weight: 600;
}

.chip:not(.chip-all)[aria-pressed='true'] {
  background: var(--site-color-identity-ink);
  border-color: var(--site-color-identity-ink);
  color: var(--site-color-surface);
  font-weight: 600;
}

.chip.zero {
  border-style: dashed;
}

.facet-panel-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-2) var(--site-space-4);
}

.facet-rows + .facet-panel-foot {
  padding-block-start: var(--site-space-3);
  border-block-start: var(--site-border-width) solid var(--site-color-line);
}

.add-facet-wrap {
  position: relative;
  display: inline-grid;
  color: var(--site-color-text-muted);
}

.add-facet-select {
  appearance: none;
  min-block-size: 2rem;
  min-inline-size: 11rem;
  padding: var(--site-space-1) 1.75rem var(--site-space-1) var(--site-space-3);
  font-family: var(--vp-font-family-base);
  font-size: var(--site-text-xs);
  font-weight: 500;
  color: var(--site-color-text);
  background: var(--site-color-surface);
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-control);
  cursor: pointer;
  touch-action: manipulation;
}

.add-facet-select:disabled {
  color: var(--site-color-text-inactive);
  background: transparent;
  cursor: not-allowed;
}

.add-facet-caret {
  position: absolute;
  inset-inline-end: var(--site-space-2);
  inset-block-start: 50%;
  translate: 0 -50%;
  inline-size: 0.875rem;
  block-size: 0.875rem;
  pointer-events: none;
}

.add-facet-wrap:has(:disabled) {
  color: var(--site-color-text-inactive);
}

.foot-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--site-space-2);
  font-size: var(--site-text-xs);
  color: var(--site-color-text-muted);
  font-variant-numeric: tabular-nums;
}

.result-count strong {
  color: var(--site-color-text);
}

.text-action {
  font: inherit;
  font-size: var(--site-text-xs);
  font-weight: 500;
  color: var(--site-color-interaction);
  background: transparent;
  border: 0;
  border-radius: var(--site-radius-control);
  padding: var(--site-space-1) var(--site-space-2);
  min-block-size: 1.75rem;
  cursor: pointer;
  touch-action: manipulation;
}

.facet-glossary {
  padding-block-start: var(--site-space-2);
  border-block-start: var(--site-border-width) solid var(--site-color-line);
  font-size: var(--site-text-xs);
  color: var(--site-color-text-muted);
}

.facet-glossary summary {
  cursor: pointer;
  font-weight: 500;
  color: var(--site-color-text-muted);
}

.glossary-list {
  display: grid;
  gap: var(--site-space-2) var(--site-space-5);
  margin: var(--site-space-3) 0 0;
}

@media (min-width: 40rem) {
  .glossary-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.glossary-item dt {
  font-family: var(--vp-font-family-mono);
  font-weight: 600;
  color: var(--site-color-text);
}

.glossary-item dd {
  margin: var(--site-space-0-5) 0 0;
  line-height: 1.5;
}

.group-section {
  margin-block-start: var(--site-space-6);
}

/* Overrides .vp-doc h2 top margin/border for clean section headers inside the index. */
.group-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--site-space-3);
  margin: 0 0 var(--site-space-2);
  padding: 0 0 var(--site-space-2);
  border-block-start: 0;
  border-block-end: var(--site-border-width) solid var(--site-color-line);
  font-size: 1.125rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.group-count {
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-xs);
  font-weight: 500;
  color: var(--site-color-text-muted);
  font-variant-numeric: tabular-nums;
}

.entry-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.entry-row {
  margin: 0;
  padding-block: var(--site-space-4);
  border-block-end: var(--site-border-width) solid var(--site-color-line);
  display: grid;
  gap: var(--site-space-2);
}

.entry-top {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--site-space-1-5) var(--site-space-4);
}

.entry-title {
  display: inline-flex;
  align-items: baseline;
  gap: var(--site-space-1-5);
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--site-color-text);
  scroll-margin-top: calc(
    var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 1.5rem
  );
}

.entry-title.mono {
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-md);
  overflow-wrap: anywhere;
}

.entry-anchor {
  font-weight: 500;
  color: var(--site-color-interaction);
  text-decoration: none;
  opacity: 0;
}

.entry-anchor:focus-visible {
  opacity: 1;
}

@media (hover: none) {
  .entry-anchor {
    opacity: 1;
  }
}

.entry-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--site-space-1) var(--site-space-3);
  font-size: var(--site-text-sm);
}

.entry-summary {
  margin: 0;
  font-size: var(--site-text-sm);
  line-height: 1.55;
  color: var(--site-color-text-muted);
  max-inline-size: 72ch;
}

.entry-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-2) var(--site-space-4);
}

.row-facets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-1-5);
}

.row-facet {
  display: inline-flex;
  align-items: baseline;
  gap: var(--site-space-1);
  padding: var(--site-space-0-5) var(--site-space-2);
  border-radius: 6px;
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-caption);
  line-height: 1.4;
  border: var(--site-border-width) solid var(--site-color-line);
  background: transparent;
  color: var(--site-color-text-muted);
  cursor: pointer;
  touch-action: manipulation;
}

.row-facet .rv {
  font-weight: 500;
}

.row-facet.signal {
  background: var(--site-color-diagram-wash);
  border-color: var(--site-color-interaction);
}

.row-facet.signal .rv {
  color: var(--site-color-text);
  font-weight: 600;
}

.row-facet.active {
  background: var(--site-color-identity-ink);
  border-color: var(--site-color-identity-ink);
  color: var(--site-color-surface);
}

.row-facet.active .rv {
  color: var(--site-color-surface);
  font-weight: 600;
}

.entry-side {
  font-size: var(--site-text-xs);
  color: var(--site-color-text-muted);
}

.entrypoints-details summary {
  cursor: pointer;
  font-family: var(--vp-font-family-mono);
}

.entrypoints-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-1) var(--site-space-1-5);
  margin-block-start: var(--site-space-2);
}

.empty-state {
  border: var(--site-border-width) dashed var(--site-color-line);
  border-radius: var(--site-radius-card);
  background: var(--site-color-surface-soft);
  padding: var(--site-space-5);
  margin-block: var(--site-space-4);
}

.empty-title {
  margin: 0 0 var(--site-space-2);
  padding: 0;
  border: 0;
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.4;
}

.empty-copy {
  margin: 0 0 var(--site-space-3);
  font-size: var(--site-text-sm);
  color: var(--site-color-text-muted);
}

.empty-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-2);
}

.site-button.primary {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  border-color: var(--vp-button-brand-border);
}

.faceted-index :is(button, select, summary, a):focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
  border-radius: var(--site-radius-control-inner);
}

@media (hover: hover) and (pointer: fine) {
  .chip:not([aria-pressed='true']):hover {
    border-color: var(--site-color-interaction);
    background: var(--site-color-surface-hover);
    color: var(--site-color-text);
  }

  .row-remove:hover {
    color: var(--site-color-text);
    background: var(--site-color-surface-hover);
    border-color: var(--site-color-line);
  }

  .add-facet-select:not(:disabled):hover,
  .row-facet:not(.active):hover {
    border-color: var(--site-color-interaction);
  }

  .text-action:hover {
    background: var(--site-color-surface-hover);
    color: var(--site-color-interaction-hover);
  }

  .entry-title:hover .entry-anchor {
    opacity: 1;
  }

  .site-button.primary:hover {
    background: var(--vp-button-brand-hover-bg);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .chip,
  .row-facet,
  .row-remove,
  .add-facet-select,
  .text-action,
  .entry-anchor {
    transition:
      background-color var(--site-duration-fast) var(--ease-out),
      border-color var(--site-duration-fast) var(--ease-out),
      color var(--site-duration-fast) var(--ease-out),
      opacity var(--site-duration-fast) var(--ease-out);
  }
}

@media (forced-colors: active) {
  .chip:not(.chip-all)[aria-pressed='true'],
  .row-facet.active {
    background: Highlight;
    color: HighlightText;
    border-color: Highlight;
  }

  .row-facet.signal {
    border-color: Highlight;
  }
}
</style>
