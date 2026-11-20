<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import { withBase } from 'vitepress';
import ExampleEmbed from './ExampleEmbed.vue';
import StateViewDiagram from './StateViewDiagram.vue';
import { EXAMPLES, staticSrc } from './examples';
import { cardForHash, INITIAL_CARD, type CardId } from './features-tour-states';

const example = EXAMPLES['features-tour'];

const card = ref<CardId>(INITIAL_CARD);

const from = ref<CardId>();

const entries = ref(0);

const panel = useTemplateRef('panel');

// Keyed by document: a frame's WindowProxy outlives a reload, its listeners do not.
const watched = new WeakSet<Document>();

// The frame is same-origin and the example routes by hash, so its location is readable here.
function follow(frame: HTMLIFrameElement) {
  try {
    const view = frame.contentWindow;

    if (!view || view.location.origin !== location.origin) return;

    const read = () => {
      const next = cardForHash(view.location.hash);

      if (!next || next === card.value) return;

      from.value = card.value;
      card.value = next;
      entries.value += 1;
    };

    read();

    if (watched.has(view.document)) return;
    watched.add(view.document);
    view.addEventListener('hashchange', read);
  } catch {
    // An unreadable frame: the diagram keeps the card it last showed.
  }
}

// Restart reloads the frame into a new window, so every load is followed.
function onLoad({ target }: Event) {
  if (target instanceof HTMLIFrameElement) follow(target);
}

// A frame that loaded before hydration fired its load event unheard.
onMounted(() => {
  const frame = panel.value?.querySelector('iframe');

  if (frame) follow(frame);
});
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
        <div ref="panel" class="panel app-panel" @load.capture="onLoad">
          <h3 class="panel-title">The app</h3>
          <div class="embed">
            <ExampleEmbed
              :src="staticSrc('features-tour')"
              :title="`${example.title} example`"
              :height="example.height"
            />
          </div>
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
  /* A scrim over a monochrome texture blended into the logo's gradient; the texture's halftone dots stay crisp at exactly 2x. */
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
  image-rendering: pixelated;
  /* Stacked, the frame is narrower than the column check:embeds measures, so it reserves a phone's height. */
  --see-it-run-narrow-frame: 600px;
}

@media (min-width: 40rem) {
  .panels {
    --gutter: var(--site-space-4);
    margin-inline: 0;
    border-radius: calc(var(--site-radius-card) + var(--gutter));
  }
}

/* Two columns where the diagram keeps its natural width; the app takes the rest. */
@container (inline-size >= 52rem) {
  .panels {
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

.embed {
  margin-block-start: var(--site-space-3);
}

@container (inline-size < 30rem) {
  .embed :deep(.example-embed:not(:modal) iframe) {
    height: min(
      var(--see-it-run-narrow-frame),
      var(--example-frame-max-height)
    );
  }
}

.diagram-ground {
  display: grid;
  place-items: start center;
  padding-block-start: var(--site-space-4);
}

/* The tile is the frame, so the embed drops its own border: tile, then card. */
.embed :deep(.example-embed:not(:modal) iframe) {
  border-color: transparent;
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
