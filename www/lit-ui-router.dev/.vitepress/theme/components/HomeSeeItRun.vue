<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { withBase } from 'vitepress';
import { revealOnStateLinks } from 'examples/features-tour/state-links';
import HomeTour from './HomeTour.vue';
import StateViewDiagram from './StateViewDiagram.vue';
import {
  cardForHash,
  hashForCard,
  INITIAL_CARD,
  TOUR_LANDMARK,
  type CardId,
} from './features-tour-states';

const section = useTemplateRef('section');

/** The card the intro's one example link opens. */
const EXAMPLE_CARD: CardId = 'views';

const card = ref<CardId>(INITIAL_CARD);

const from = ref<CardId>();

const entries = ref(0);

// The tour's router writes its state to this page's fragment, so the diagram reads the page's own hash; a new card is a re-entry.
function follow() {
  const next = cardForHash(location.hash);

  if (!next || next === card.value) return;

  from.value = card.value;
  card.value = next;
  entries.value += 1;
}

let stopRevealing: (() => void) | undefined;

onMounted(() => {
  // The card the page was opened on is where the diagram starts, not a re-entry.
  card.value = cardForHash(location.hash) ?? INITIAL_CARD;
  window.addEventListener('hashchange', follow);
  stopRevealing = revealOnStateLinks(section.value!, TOUR_LANDMARK);
});

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', follow);
  stopRevealing?.();
});
</script>

<template>
  <!-- tabindex: a followed state link moves focus here, as a followed anchor does. -->
  <section
    :id="TOUR_LANDMARK"
    ref="section"
    class="see-it-run"
    aria-labelledby="see-it-run-title"
    tabindex="-1"
  >
    <div class="container">
      <!-- The permalink sits beside the heading, not in it, so the section's name stays "See it run". -->
      <div class="heading">
        <h2 id="see-it-run-title" class="title">See it run</h2>
        <a
          class="permalink"
          :href="`#${TOUR_LANDMARK}`"
          aria-label="Permalink to “See it run”"
          >#</a
        >
      </div>
      <p class="lede">
        The feature cards above run here as a small lit-ui-router app. Each card
        re-enters one state with a new parameter, and the diagram follows each
        transition.
      </p>
      <p class="lede">
        The app shares this page's URL fragment with the page's own anchors, so
        a link can open a card directly, as the links on the cards above do. For
        example,
        <a :href="hashForCard(EXAMPLE_CARD)"
          ><code>{{ hashForCard(EXAMPLE_CARD) }}</code></a
        >
        opens Views.
      </p>
      <div class="panels">
        <div class="flames" aria-hidden="true" />
        <div class="panel app-panel">
          <h3 class="panel-title">The app</h3>
          <!-- Announces the card after a link or the pager changes it; the app's own view is not a live region. -->
          <p class="visually-hidden" role="status">
            The app shows the {{ card }} card.
          </p>
          <HomeTour class="embed" :prefix="TOUR_LANDMARK" />
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
  /* Clears the fixed nav when a link scrolls here, as the docs headings do. */
  scroll-margin-top: calc(
    var(--vp-nav-height) + var(--vp-layout-top-height, 0px) + 1.5rem
  );
}

/* Focus lands here only from a followed link: ringed when that link was followed by keyboard, not by pointer. */
.see-it-run:focus {
  outline: none;
}

.see-it-run:focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
  border-radius: var(--site-radius-control-inner);
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

.heading {
  display: flex;
  align-items: baseline;
  gap: var(--site-space-2);
}

.permalink {
  font-size: 1.5rem;
  font-weight: 500;
  line-height: 1.3;
  color: var(--site-color-interaction);
  opacity: 0;
  transition: opacity var(--site-duration-base) var(--ease-out);
}

.permalink:focus-visible {
  opacity: 1;
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
  border-radius: var(--site-radius-control-inner);
}

@media (hover: hover) and (pointer: fine) {
  .heading:hover .permalink {
    opacity: 1;
  }
}

@media (hover: none) {
  .permalink {
    opacity: 1;
  }
}

.lede a {
  color: var(--site-color-interaction);
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  transition: color var(--site-duration-base) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .lede a:hover {
    color: var(--site-color-interaction-hover);
  }
}

.lede a:focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
  border-radius: var(--site-radius-control-inner);
}

/* The link's colour, not the code colour, in every state; the fragment stays on one line. */
.lede a > code {
  color: inherit;
  white-space: nowrap;
}

.lede code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.875em;
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
.flames,
.flames::before {
  position: absolute;
  inset: 0;
}

.flames {
  z-index: -1;
}

.flames::before {
  content: '';
  inset-block: calc(-1 * var(--drift-travel, 0px));
  background:
    var(--site-see-it-run-steps) left top / var(--site-see-it-run-tile),
    var(--site-see-it-run-gradient);
  /* A longhand with no var(): one in the declaration resolves the image again, and repaints the layer, on every frame the offset moves. */
  mask-image: url(/images/see-it-run-tile.svg);
  mask-size: var(--site-see-it-run-tile);
}

/* Registered so the view timeline can interpolate it; a number, because a minified `0` initial value is no <length> to Firefox. */
@property --see-it-run-drift {
  syntax: '<number>';
  inherits: true;
  initial-value: 0;
}

/* The flames trail the page and ease to rest: the timeline moves the offset on the wrapper, and the transition on its layer follows it. The layer is taller by the travel, so no edge shows. */
@media (prefers-reduced-motion: no-preference) and (forced-colors: none) {
  @supports (animation-timeline: view()) and (animation-range: entry) {
    .panels {
      view-timeline: --see-it-run-panels block;
    }

    .flames {
      --drift-travel: 48px;
      animation: see-it-run-drift linear both;
      animation-timeline: --see-it-run-panels;
    }

    .flames::before {
      translate: 0 calc(var(--see-it-run-drift) * var(--drift-travel));
      transition: translate 600ms var(--ease-out);
      will-change: translate;
    }
  }
}

@keyframes see-it-run-drift {
  from {
    --see-it-run-drift: -1;
  }

  to {
    --see-it-run-drift: 1;
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

.app-panel {
  container-type: inline-size;
}

/* The tour's height until it mounts: its tallest card at each width, measured in three engines. The lead wraps to one more line at each step down. */
.embed {
  --tour-height: 469px;
  margin-block-start: var(--site-space-3);
}

@container (inline-size >= 311px) {
  .embed {
    --tour-height: 445px;
  }
}

@container (inline-size >= 367px) {
  .embed {
    --tour-height: 421px;
  }
}

@container (inline-size >= 547px) {
  .embed {
    --tour-height: 397px;
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

  .flames {
    display: none;
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
