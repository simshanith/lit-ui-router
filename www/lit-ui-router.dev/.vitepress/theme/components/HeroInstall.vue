<template>
  <!-- lit.dev's install CTA: the command, linking to the package page. -->
  <div class="action">
    <a
      class="hero-install"
      href="https://npmx.dev/package/lit-ui-router"
      target="_blank"
      rel="noopener"
    >
      <span class="prompt" aria-hidden="true">&gt;</span>
      <code>npm i lit-ui-router</code>
    </a>
  </div>
</template>

<style scoped>
.action {
  grid-column: 1 / -1;
}

.hero-install {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--site-space-2);
  block-size: 44px;
  padding-inline: var(--site-space-4);
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-md);
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: var(--site-border-width) solid var(--vp-c-divider);
  border-radius: var(--site-radius-pill);
  touch-action: manipulation;
  transition: border-color var(--site-duration-fast) var(--ease-out);
}

@media (prefers-reduced-motion: no-preference) {
  .hero-install {
    transition:
      border-color var(--site-duration-fast) var(--ease-out),
      transform var(--site-duration-fast) var(--ease-out);
  }
}

.hero-install:focus-visible {
  outline: var(--site-focus-ring-width) solid var(--vp-c-brand-1);
  outline-offset: var(--site-focus-ring-offset);
}

@media (hover: hover) and (pointer: fine) {
  .hero-install:hover {
    border-color: var(--vp-c-brand-1);
  }
}

.hero-install:active {
  transform: scale(0.97);
}

.prompt,
.hero-install code {
  text-box: trim-both cap alphabetic;
}

.prompt {
  color: var(--vp-c-text-3);
}

.hero-install code {
  font: inherit;
  background: none;
  padding: 0;
}
</style>
