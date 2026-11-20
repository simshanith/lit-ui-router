<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { withBase } from 'vitepress';
import ExampleEmbed from './ExampleEmbed.vue';
import StateViewDiagram, { type Backdrop } from './StateViewDiagram.vue';
import { EXAMPLES, staticSrc } from './examples';
import { cardForHash, INITIAL_CARD, type CardId } from './features-tour-states';

const example = EXAMPLES['features-tour'];

const card = ref<CardId>(INITIAL_CARD);

const from = ref<CardId>();

const entries = ref(0);

const panel = useTemplateRef('panel');

const stage = useTemplateRef('stage');

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

// Before measuring, the drawing samples the burst at its own size.
const backdrop = ref<Backdrop>({ x: -2, y: -2, width: 340, height: 362 });

// Every ring shows the one burst painted over the whole stage, so each is told where it sits in it.
function place() {
  const ground = stage.value;

  if (!ground) return;

  const box = ground.getBoundingClientRect();

  ground.style.setProperty('--burst-w', `${box.width}px`);
  ground.style.setProperty('--burst-h', `${box.height}px`);

  for (const ring of ground.querySelectorAll<HTMLElement>('[data-ring]')) {
    const at = ring.getBoundingClientRect();

    ring.style.setProperty('--burst-x', `${at.left - box.left}px`);
    ring.style.setProperty('--burst-y', `${at.top - box.top}px`);
  }

  const drawing = ground.querySelector<SVGSVGElement>('.state-diagram svg');

  if (!drawing) return;

  const at = drawing.getBoundingClientRect();
  const view = drawing.viewBox.baseVal;
  const scale = view.width / at.width;

  backdrop.value = {
    x: view.x + (box.left - at.left) * scale,
    y: view.y + (box.top - at.top) * scale,
    width: box.width * scale,
    height: box.height * scale,
  };
}

let resized: ResizeObserver | undefined;

onMounted(() => {
  // A frame that loaded before hydration fired its load event unheard.
  const frame = panel.value?.querySelector('iframe');

  if (frame) {
    frame.dataset.ring = '';
    follow(frame);
  }

  resized = new ResizeObserver(place);

  for (const el of stage.value?.querySelectorAll('[data-ring], svg') ?? [])
    resized.observe(el);

  if (stage.value) resized.observe(stage.value);
});

onBeforeUnmount(() => resized?.disconnect());
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
      <div ref="stage" class="panels">
        <div ref="panel" class="panel" @load.capture="onLoad">
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
          <div class="diagram-ground" data-ring>
            <StateViewDiagram
              :card="card"
              :from="from"
              :entries="entries"
              :backdrop="backdrop"
            />
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
  display: grid;
  gap: var(--site-space-8);
  margin-block-start: var(--site-space-6);
}

/* Two columns only where each keeps the diagram's natural width. */
@container (inline-size >= 50rem) {
  .panels {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--site-space-8) 3rem;
  }
}

.panel {
  min-inline-size: 0;
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

/* A ring is a window onto the burst painted over the whole stage: the burst fills the border box, sized to the stage and shifted by the ring's place in it; the fill covers the rest. */
.embed :deep(.example-embed iframe),
.diagram-ground {
  --ring-fill: var(--site-color-surface);
  border: 2px solid transparent;
  background:
    linear-gradient(var(--ring-fill) 0 0) padding-box,
    var(--site-burst-image) border-box no-repeat;
  background-position:
    0 0,
    calc(-1 * var(--burst-x, 0px)) calc(-1 * var(--burst-y, 0px));
  background-size:
    auto,
    var(--burst-w, 100%) var(--burst-h, 100%);
}

.diagram-ground {
  --ring-fill: var(--site-color-surface-soft);
  margin-block-start: var(--site-space-3);
  padding: var(--site-space-8) var(--site-space-3);
  border-radius: var(--site-radius-card);
}

/* Expanded, the frame leaves the stage, so it takes a plain line. */
.embed :deep(.example-embed:modal iframe) {
  border: var(--site-border-width) solid var(--site-color-line);
  background: var(--site-color-surface);
}

@media (forced-colors: active) {
  .embed :deep(.example-embed iframe),
  .diagram-ground {
    border-color: CanvasText;
    background: Canvas;
  }
}

.next {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-2) var(--site-space-6);
  margin-block: var(--site-space-8) 0;
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
