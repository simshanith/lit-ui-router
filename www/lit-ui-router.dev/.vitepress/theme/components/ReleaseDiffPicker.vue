<script setup lang="ts">
import rcompare from 'semver/functions/rcompare.js';
import { onMounted, shallowRef } from 'vue';

import { pickerPair } from '../../../worker/releases/ledger';

const { name } = defineProps<{ name: string }>();

/** The registry's abbreviated packument, as far as the picker reads it. */
interface Packument {
  versions: Record<string, { version: string }>;
}

const FIELDS = [
  { field: 'from', label: 'From' },
  { field: 'to', label: 'To' },
] as const;

/** npm's versions, newest first, and the pair the picker starts on; empty until the registry answers. */
const picked = shallowRef<{
  versions: readonly string[];
  from?: string;
  to?: string;
}>({ versions: [] });

const release = `/releases/${encodeURIComponent(name)}/`;

onMounted(async () => {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    { headers: { Accept: 'application/vnd.npm.install-v1+json' } },
  ).catch(() => null);

  if (!response?.ok) return;

  // SAFETY: the registry's documented shape; anything else throws here, leaving the text inputs.
  const packument = (await response.json()) as Packument;
  const versions = Object.keys(packument.versions).sort(rcompare);
  const { from, to } = pickerPair(versions.map((version) => ({ version })));

  if (versions.length > 1)
    picked.value = { versions, from: from?.version, to: to?.version };
});
</script>

<template>
  <p>
    Every release, with its notes and git tag, is on the
    <a :href="release" target="_self">{{ name }} releases page</a>. Compare two
    versions:
  </p>
  <form
    class="compare"
    method="get"
    :action="`${release}diff`"
    aria-label="Compare two versions"
    target="_blank"
    rel="noopener"
  >
    <label v-for="{ field, label } in FIELDS" :key="field">
      {{ label }}
      <span v-if="picked.versions.length" class="select">
        <select :name="field">
          <option
            v-for="version in picked.versions"
            :key="version"
            :value="version"
            :selected="version === picked[field]"
          >
            {{ version }}
          </option>
        </select>
        <!-- Lucide's chevron-down: a <select> takes no pseudo-element, so the caret is a sibling. -->
        <svg
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
      </span>
      <input
        v-else
        :name="field"
        required
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <button type="submit">
      Compare <span class="visually-hidden">(opens in a new tab)</span>
    </button>
  </form>
</template>

<style scoped>
.compare {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem 1.25rem;
  margin-block: var(--site-space-4);
}

.compare label {
  display: grid;
  gap: 0.25rem;
}

.compare > label {
  color: var(--site-color-text-muted);
  font-size: 0.875rem;
}

.compare select,
.compare input:not([type]),
.compare button {
  font: inherit;
  min-block-size: 2.5rem;
  padding-inline: 0.75rem;
  border-radius: var(--site-radius-control);
  touch-action: manipulation;
}

.compare select,
.compare input:not([type]) {
  inline-size: 11rem;
  color: var(--site-color-text);
  background: var(--site-color-surface-soft);
  border: var(--site-border-width) solid var(--site-color-line);
  font-variant-numeric: tabular-nums;
}

/* The native caret sits on the padding edge; draw it inside the end padding instead. */
.compare select {
  appearance: none;
  padding-inline-end: 2.25rem;
  background-color: var(--site-color-surface-soft);
}

.compare button {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  border: var(--site-border-width) solid var(--vp-button-brand-border);
  font-weight: 600;
}

.compare button:active {
  background: var(--vp-button-brand-active-bg);
}

.compare :focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
}

.compare .select {
  position: relative;
  display: inline-grid;
  /* Inherited, not set on the svg, so forced colors replace it. */
  color: var(--site-color-text-muted);
}

.compare .select svg {
  position: absolute;
  inset-inline-end: 0.75rem;
  inset-block-start: 50%;
  translate: 0 -50%;
  inline-size: 1rem;
  block-size: 1rem;
  pointer-events: none;
}

@media (hover: hover) and (pointer: fine) {
  .compare button:hover {
    background: var(--vp-button-brand-hover-bg);
  }
}
</style>
