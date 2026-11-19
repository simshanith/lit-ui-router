<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';

const COMMAND = 'npm i lit-ui-router lit @uirouter/core';

const copied = ref(false);

let resetTimer: ReturnType<typeof setTimeout> | undefined;

async function copyCommand() {
  try {
    await navigator.clipboard.writeText(COMMAND);
    copied.value = true;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    // Clipboard access can be unavailable in non-secure contexts; fail quietly.
  }
}

onBeforeUnmount(() => {
  clearTimeout(resetTimer);
});
</script>

<template>
  <div class="action">
    <button
      type="button"
      class="hero-install"
      :title="copied ? 'Copied' : 'Copy install command'"
      @click="copyCommand"
    >
      <span class="prompt" aria-hidden="true">&gt;</span>
      <code>{{ COMMAND }}</code>
      <span class="copy-icon" aria-hidden="true">
        <svg
          v-if="copied"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
        <svg
          v-else
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path
            d="M3.5 10.5H3a1.5 1.5 0 0 1-1.5-1.5V3A1.5 1.5 0 0 1 3 1.5h6A1.5 1.5 0 0 1 10.5 3v.5"
          />
        </svg>
      </span>
    </button>
    <span class="visually-hidden" aria-live="polite">{{
      copied ? 'Install command copied to clipboard' : ''
    }}</span>
  </div>
</template>

<style scoped>
.action {
  grid-column: 1 / -1;
  min-inline-size: 0;
}

.hero-install {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--site-space-1-5);
  inline-size: 100%;
  min-inline-size: 0;
  max-inline-size: 100%;
  min-block-size: 44px;
  padding-inline: var(--site-space-3);
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-xs);
  color: var(--site-color-text);
  background: var(--site-color-surface-soft);
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-pill);
  cursor: pointer;
  touch-action: manipulation;
  transition:
    background-color var(--site-duration-fast) var(--ease-out),
    border-color var(--site-duration-fast) var(--ease-out);
}

@media (min-width: 480px) {
  .hero-install {
    gap: var(--site-space-2);
    padding-inline: var(--site-space-4);
    font-size: var(--site-text-sm);
  }
}

@media (min-width: 640px) {
  .hero-install {
    font-size: var(--site-text-md);
  }
}

@media (prefers-reduced-motion: no-preference) {
  .hero-install {
    transition:
      background-color var(--site-duration-fast) var(--ease-out),
      border-color var(--site-duration-fast) var(--ease-out),
      transform var(--site-duration-fast) var(--ease-out);
  }
}

.hero-install:focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
}

@media (hover: hover) and (pointer: fine) {
  .hero-install:hover {
    background: var(--site-color-surface-hover);
    border-color: var(--site-color-interaction);
  }
}

.hero-install:active {
  transform: scale(0.97);
}

.prompt,
.hero-install code {
  text-box: trim-both cap alphabetic;
}

.prompt,
.copy-icon {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--site-color-text-muted);
}

.hero-install code {
  min-inline-size: 0;
  font: inherit;
  background: none;
  padding: 0;
  white-space: nowrap;
  overflow-x: auto;
}
</style>
