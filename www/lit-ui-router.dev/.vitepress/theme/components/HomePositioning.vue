<template>
  <!-- Rendered in home-features-before so home-hero-after stays open for #2129's releases strip. -->
  <div class="home-positioning">
    <div class="container">
      <p class="copy">
        For Lit apps that have outgrown a path-to-component map: nested layouts,
        data that loads before a view shows, guards and redirects in one place.
        It runs on <code>@uirouter/core</code>, the same core as UI-Router for
        Angular and React.
      </p>
    </div>
  </div>
</template>

<style scoped>
.home-positioning {
  padding-inline: 1.5rem;
  margin-block-end: var(--site-space-6);
}

@media (min-width: 40rem) {
  .home-positioning {
    padding-inline: 3rem;
    margin-block-end: var(--site-space-8);
  }
}

@media (min-width: 60rem) {
  .home-positioning {
    padding-inline: 4rem;
  }
}

.container {
  margin-inline: auto;
  max-inline-size: 72rem;
}

.copy {
  margin: 0;
  max-inline-size: 68ch;
  font-size: var(--site-text-md);
  line-height: 1.6;
  color: var(--site-color-text-muted);
  text-wrap: pretty;
}

.copy code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.9em;
  color: var(--site-color-text);
  background: var(--vp-code-bg);
  padding: 0.1em 0.35em;
  border-radius: var(--site-radius-control-inner);
}
</style>
