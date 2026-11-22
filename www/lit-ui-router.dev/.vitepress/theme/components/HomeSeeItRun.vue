<script setup lang="ts">
import { ref } from 'vue';
import { withBase } from 'vitepress';
import HomeTourFrame from './HomeTourFrame.vue';
import StateViewDiagram from './StateViewDiagram.vue';
import { EXAMPLES, staticSrc } from './examples';
import { cardForHash, INITIAL_CARD, type CardId } from './features-tour-states';

const example = EXAMPLES['features-tour'];

const card = ref<CardId>(INITIAL_CARD);

const from = ref<CardId>();

const entries = ref(0);

// The frame reports its hash on load and on every hashchange; a new card is a re-entry.
function onHash(hash: string) {
  const next = cardForHash(hash);

  if (!next || next === card.value) return;

  from.value = card.value;
  card.value = next;
  entries.value += 1;
}
</script>

<template>
  <section class="see-it-run" aria-labelledby="see-it-run-title">
    <div class="container">
      <h2 id="see-it-run-title" class="title">See it run</h2>
      <p class="lede">
        The feature cards above as a small lit-ui-router app. Each card is the
        same state with a new parameter, and the diagram follows the router as
        it re-enters the state.
      </p>
      <div class="panels">
        <div class="panel app-panel">
          <h3 class="panel-title">The app</h3>
          <HomeTourFrame
            class="embed"
            :src="staticSrc('features-tour')"
            :title="`${example.title} example`"
            @hash="onHash"
          />
        </div>
        <div class="panel diagram-panel">
          <h3 class="panel-title">Its state and view</h3>
          <div class="diagram-ground">
            <StateViewDiagram :card="card" :from="from" :entries="entries" />
          </div>
        </div>
      </div>
      <p class="next">
        <a :href="withBase('/tutorial/helloworld')">Start the tutorial</a>
        <a :href="withBase('/introduction')">Read the introduction</a>
      </p>
    </div>
  </section>
</template>

<style scoped>
.see-it-run {
  padding-inline: 1.5rem;
  margin-block-start: 3rem;
}

@media (min-width: 40rem) {
  .see-it-run {
    padding-inline: 3rem;
    margin-block-start: 4rem;
  }
}

@media (min-width: 60rem) {
  .see-it-run {
    padding-inline: 4rem;
  }
}

.container {
  margin-inline: auto;
  max-inline-size: 72rem;
  container-type: inline-size;
}

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: -0.01em;
  color: var(--site-color-text);
}

.lede {
  margin-block: var(--site-space-2) 0;
  max-inline-size: 68ch;
  font-size: var(--site-text-md);
  line-height: 1.6;
  color: var(--site-color-text-muted);
  text-wrap: pretty;
}

.panels {
  --gutter: var(--site-space-3);
  display: grid;
  gap: var(--gutter);
  margin-block-start: var(--site-space-6);
  /* Full-bleed on narrow screens, out to the section's own padding. */
  margin-inline: -1.5rem;
  padding: var(--gutter);
  position: relative;
  isolation: isolate;
  overflow: clip;
  /* The ground: the logo's gradient under a scrim. */
  background:
    linear-gradient(
      color-mix(
          in oklab,
          var(--site-color-surface) var(--site-see-it-run-scrim),
          transparent
        )
        0 0
    ),
    var(--site-see-it-run-gradient);
}

/* The Lit flames: the same gradient cut to the flame tile, so each flame takes the colour under it, stepped per column. */
.panels::before {
  --drift: 0px;
  content: '';
  position: absolute;
  inset: calc(-1 * var(--drift)) 0;
  z-index: -1;
  background:
    var(--site-see-it-run-steps) left top / var(--site-see-it-run-tile),
    var(--site-see-it-run-gradient);
  mask: var(--site-see-it-run-texture) left top / var(--site-see-it-run-tile);
}

/* The flames trail the page by 72px over the section's pass through the viewport; the layer is that much taller, so no edge shows. */
@media (prefers-reduced-motion: no-preference) and (forced-colors: none) {
  @supports (animation-timeline: view()) and (animation-range: entry) {
    .panels {
      view-timeline: --see-it-run-panels block;
    }

    .panels::before {
      --drift: 36px;
      animation: see-it-run-drift linear both;
      animation-timeline: --see-it-run-panels;
    }
  }
}

@keyframes see-it-run-drift {
  from {
    translate: 0 calc(-1 * var(--drift));
  }

  to {
    translate: 0 var(--drift);
  }
}

@media (min-width: 40rem) {
  .panels {
    margin-inline: 0;
    border-radius: calc(var(--site-radius-card) + var(--gutter));
  }
}

/* Two columns where the diagram keeps its natural width; the app takes the rest. Side by side, the gutters slim to a hairline of texture. */
@container (inline-size >= 52rem) {
  .panels {
    --gutter: var(--site-space-2);
    grid-template-columns: minmax(0, 1fr) minmax(0, 26rem);
  }
}

/* The tiles are cut out of the image: solid grounds, so the image shows only in the gutters. */
.panel {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
  padding: var(--site-space-3);
  background: var(--site-color-surface);
  border-radius: var(--site-radius-card);
}

@media (min-width: 40rem) {
  .panel {
    padding: var(--site-space-4);
  }
}

.diagram-panel {
  background: var(--site-color-surface-soft);
}

.panel-title {
  margin: 0;
  font-size: var(--site-text-sm);
  font-weight: 600;
  line-height: 1.5;
  color: var(--site-color-text);
}

/* The frame sizes itself to the tour once it loads; this is its height until then. */
.embed {
  --tour-frame-height: 426px;
  margin-block-start: var(--site-space-3);
}

/* The drawing sits under its heading and the transition log closes the tile. */
.diagram-ground {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding-block-start: var(--site-space-4);
}

@media (forced-colors: active) {
  .panels {
    background: none;
  }

  .panels::before {
    content: none;
  }

  .panel {
    border: var(--site-border-width) solid CanvasText;
  }
}

.next {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-2) var(--site-space-6);
  margin-block: var(--site-space-6) 0;
  font-size: var(--site-text-md);
  line-height: 1.6;
}

.next a {
  font-weight: 500;
  color: var(--site-color-interaction);
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  transition: color var(--site-duration-base) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .next a:hover {
    color: var(--site-color-interaction-hover);
  }
}

.next a:focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
  border-radius: var(--site-radius-control-inner);
}
</style>
