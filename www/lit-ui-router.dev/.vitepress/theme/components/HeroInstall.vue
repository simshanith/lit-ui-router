<script setup lang="ts">
import { ref } from 'vue';

const command = 'npm i lit-ui-router';

const copied = ref(false);

let reset: ReturnType<typeof setTimeout> | undefined;

async function copy() {
  await navigator.clipboard.writeText(command);
  copied.value = true;
  clearTimeout(reset);
  reset = setTimeout(() => (copied.value = false), 2000);
}
</script>

<template>
  <div class="action">
    <button
      type="button"
      class="hero-install"
      :class="{ copied }"
      :aria-label="`Copy install command: ${command}`"
      @click="copy"
    >
      <span class="prompt" aria-hidden="true">$</span>
      <code>{{ command }}</code>
      <span class="icon" aria-hidden="true"></span>
    </button>
    <span class="visually-hidden" role="status">{{
      copied ? 'Copied' : ''
    }}</span>
  </div>
</template>

<style scoped>
/* VPHero's .action wrapper gives the row its spacing; the button matches VPButton's medium size. */
.action {
  flex-shrink: 0;
  padding: 6px;
}

.hero-install {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px 0 18px;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  cursor: copy;
  touch-action: manipulation;
  transition:
    border-color 0.15s var(--ease-out),
    transform 0.15s var(--ease-out);
}

.hero-install:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 1px;
}

@media (hover: hover) and (pointer: fine) {
  .hero-install:hover {
    border-color: var(--vp-c-brand-1);
  }
}

.hero-install:active {
  transform: scale(0.97);
}

.prompt {
  color: var(--vp-c-text-3);
}

.hero-install code {
  font: inherit;
  background: none;
  padding: 0;
}

.icon {
  inline-size: 18px;
  block-size: 18px;
  background-color: var(--vp-c-text-2);
  mask: var(--vp-icon-copy) center / contain no-repeat;
}

.copied .icon {
  background-color: var(--vp-c-brand-1);
  mask-image: var(--vp-icon-copied);
}

.visually-hidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
