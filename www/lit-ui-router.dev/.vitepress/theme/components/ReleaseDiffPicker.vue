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
  >
    <label v-for="{ field, label } in FIELDS" :key="field">
      {{ label }}
      <select v-if="picked.versions.length" :name="field">
        <option
          v-for="version in picked.versions"
          :key="version"
          :value="version"
          :selected="version === picked[field]"
        >
          {{ version }}
        </option>
      </select>
      <input
        v-else
        :name="field"
        required
        autocomplete="off"
        spellcheck="false"
      />
    </label>
    <fieldset>
      <legend>Diff</legend>
      <label
        ><input type="radio" name="via" value="diffshub" checked /> Git source
        on DiffsHub</label
      >
      <label
        ><input type="radio" name="via" value="files" /> Published files</label
      >
    </fieldset>
    <button type="submit">Compare</button>
  </form>
</template>

<style scoped>
.compare {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem 1.25rem;
  margin-block: 16px;
}

.compare label {
  display: grid;
  gap: 0.25rem;
}

.compare > label,
.compare legend {
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
}

.compare fieldset {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1rem;
  border: 0;
  margin: 0;
  padding: 0;
}

.compare legend {
  padding: 0;
  margin-block-end: 0.25rem;
}

.compare fieldset label {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  min-block-size: 2.5rem;
  color: var(--vp-c-text-1);
  font-size: 1rem;
}

.compare input[type='radio'] {
  accent-color: var(--vp-c-brand-1);
  margin: 0;
}

.compare select,
.compare input:not([type]),
.compare button {
  font: inherit;
  min-block-size: 2.5rem;
  padding-inline: 0.75rem;
  border-radius: 8px;
  touch-action: manipulation;
}

.compare select,
.compare input:not([type]) {
  inline-size: 11rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  font-variant-numeric: tabular-nums;
}

.compare button {
  color: var(--vp-button-brand-text);
  background: var(--vp-button-brand-bg);
  border: 1px solid var(--vp-button-brand-border);
  font-weight: 600;
}

.compare button:active {
  background: var(--vp-button-brand-active-bg);
}

.compare :focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

@media (hover: hover) and (pointer: fine) {
  .compare button:hover {
    background: var(--vp-button-brand-hover-bg);
  }
}
</style>
