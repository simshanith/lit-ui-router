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
  /* A scrim over a monochrome texture blended into the logo's gradient, at exactly 2x and smoothly scaled so the filaments read as lines. */
  background:
    linear-gradient(
      color-mix(
          in oklab,
          var(--site-color-surface) var(--site-see-it-run-scrim),
          transparent
        )
        0 0
    ),
    var(--site-see-it-run-texture) center / 2816px 1536px no-repeat,
    var(--site-see-it-run-gradient);
  background-blend-mode: normal, var(--site-see-it-run-blend), normal;
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

/* The frame reserves the tallest card's height at its own width, measured: 16px margins, the card and a 12px gap over the 32px pager, so nothing is left under the pager. The live page keeps the registry's height. */
.app-panel {
  container-type: inline-size;
}

.embed {
  --tour-frame-height: 444px;
  margin-block-start: var(--site-space-3);
}

@container (inline-size < 36rem) {
  .embed {
    --tour-frame-height: 452px;
  }
}

@container (inline-size < 26rem) {
  .embed {
    --tour-frame-height: 476px;
  }
}

@container (inline-size < 21rem) {
  .embed {
    --tour-frame-height: 500px;
  }
}

@container (inline-size < 18rem) {
  .embed {
    --tour-frame-height: 548px;
  }
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
