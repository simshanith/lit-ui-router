<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue';
import ExampleEmbed from './ExampleEmbed.vue';
import StateViewDiagram from './StateViewDiagram.vue';
import { EXAMPLES, staticSrc } from './examples';
import { FEATURES_TOUR_INITIAL, stateForHash } from './features-tour-states';

const example = EXAMPLES['features-tour'];

const active = ref(FEATURES_TOUR_INITIAL);

const panel = useTemplateRef('panel');

// Keyed by document: a frame's WindowProxy outlives a reload, its listeners do not.
const watched = new WeakSet<Document>();

// The frame is same-origin and the example routes by hash, so its location is readable here.
function follow(frame: HTMLIFrameElement) {
  try {
    const view = frame.contentWindow;

    if (!view || view.location.origin !== location.origin) return;

    const read = () => {
      active.value = stateForHash(view.location.hash) ?? active.value;
    };

    read();

    if (watched.has(view.document)) return;
    watched.add(view.document);
    view.addEventListener('hashchange', read);
  } catch {
    // An unreadable frame: the diagram keeps the state it last showed.
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
        A small app with one route for each feature above, running. Move between
        them, and the diagram marks the state the router made active.
      </p>
      <div class="panels">
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
          <h3 class="panel-title">Its states and views</h3>
          <div class="diagram-ground">
            <StateViewDiagram :active="active" />
          </div>
        </div>
      </div>
      <p class="next">
        <a href="/tutorial/helloworld">Start the tutorial</a>
        <a href="/introduction">Read the introduction</a>
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
  /* Both panels wear the current state's ink-to-glow gradient as a 2px ring. */
  --panel-ring: linear-gradient(
    135deg,
    var(--site-color-identity-ink),
    var(--site-color-diagram-glow)
  );
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

/* The ring is the border box's background showing through a transparent border, so the radius holds. */
.embed :deep(.example-embed iframe) {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--site-color-surface) 0 0) padding-box,
    var(--panel-ring) border-box;
}

.diagram-ground {
  margin-block-start: var(--site-space-3);
  padding: var(--site-space-8) var(--site-space-3);
  border: 2px solid transparent;
  background:
    linear-gradient(var(--site-color-surface-soft) 0 0) padding-box,
    var(--panel-ring) border-box;
  border-radius: var(--site-radius-card);
}

@media (forced-colors: active) {
  .embed :deep(.example-embed iframe),
  .diagram-ground {
    border-color: CanvasText;
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
