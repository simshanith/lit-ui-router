<template>
  <!-- lit.dev's install CTA: the command, linking to the package page. -->
  <div class="action">
    <a
      class="hero-install"
      href="https://npmx.dev/package/lit-ui-router"
      target="_blank"
      rel="noopener"
    >
      <span class="prompt" aria-hidden="true">$</span>
      <!-- Narrow screens wrap between the groups, never inside a package name. -->
      <code
        ><span>npm install lit-ui-router</span>{{ ' '
        }}<span>lit @uirouter/core</span></code
      >
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
  gap: 0.6em;
  min-block-size: 44px;
  padding-block: 12px;
  padding-inline: 18px;
  font-family: var(--vp-font-family-mono);
  font-size: 15px;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 22px;
  touch-action: manipulation;
  transition: border-color 0.15s var(--ease-out);
}

@media (prefers-reduced-motion: no-preference) {
  .hero-install {
    transition:
      border-color 0.15s var(--ease-out),
      transform 0.15s var(--ease-out);
  }
}

.hero-install:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
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
  text-align: center;
}

.hero-install code span {
  white-space: nowrap;
}
</style>
