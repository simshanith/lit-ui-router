<script setup lang="ts">
import { computed, useId } from 'vue';
import {
  HELLO_WORLD_STATES,
  type HelloWorldStateName,
} from './helloworld-states';

const props = defineProps<{ active: HelloWorldStateName }>();

// Leaves sit on a 4px grid inside the root box: 124 wide, 20 apart.
const leaves = HELLO_WORLD_STATES.map((state, index) => ({
  ...state,
  x: 24 + index * 144,
  mid: 86 + index * 144,
}));

// One id per instance, so two diagrams on a page keep their own gradients.
const uid = useId();

const strokes = {
  '--diagram-state-stroke': `url(#${uid}-state)`,
  '--diagram-view-stroke': `url(#${uid}-view)`,
};

const current = computed(
  () => leaves.find(({ name }) => name === props.active) ?? leaves[0],
);
</script>

<template>
  <figure class="state-diagram" :data-active="active" :style="strokes">
    <svg
      class="drawing"
      viewBox="-2 -2 320 336"
      width="320"
      height="336"
      aria-hidden="true"
    >
      <defs>
        <!-- Both run blue into orange toward the arrow, so it joins the warm ends. -->
        <linearGradient :id="`${uid}-state`" x1="0" y1="0" x2="0" y2="1">
          <stop class="cool" offset="0" />
          <stop class="mid" offset="0.5" />
          <stop class="warm" offset="1" />
        </linearGradient>
        <linearGradient :id="`${uid}-view`" x1="0" y1="0" x2="0" y2="1">
          <stop class="warm" offset="0" />
          <stop class="mid" offset="0.5" />
          <stop class="cool" offset="1" />
        </linearGradient>
      </defs>
      <text class="region" x="0" y="10">States</text>
      <rect class="box ancestor" x="0" y="24" width="316" height="120" rx="6" />
      <circle class="glyph ring on" cx="20" cy="44" r="5" />
      <circle class="glyph dot on" cx="20" cy="44" r="2" />
      <text class="name quiet" x="36" y="48.5">(root)</text>

      <g
        v-for="leaf in leaves"
        :key="leaf.name"
        class="leaf"
        :class="{ current: leaf.name === active }"
      >
        <rect class="box" :x="leaf.x" y="64" width="124" height="56" rx="6" />
        <circle class="glyph ring" :cx="leaf.x + 18" cy="84" r="5" />
        <text class="name" :x="leaf.x + 34" y="88.5">{{ leaf.name }}</text>
        <text class="url" :x="leaf.x + 34" y="107">{{ leaf.url }}</text>
        <path class="edge" :d="`M${leaf.mid} 120V207`" />
        <path class="arrowhead" :d="`M${leaf.mid - 5} 206h10l-5 8z`" />
        <text class="edge-label" :x="leaf.mid + 12" y="178">
          {{ leaf.name === active ? 'renders now' : 'when active' }}
        </text>
      </g>

      <text class="region" x="0" y="204">Views</text>
      <rect class="box" x="0" y="216" width="316" height="116" rx="6" />
      <rect class="glyph frame" x="15" y="231" width="10" height="10" rx="2" />
      <text class="name" x="36" y="240.5">&lt;ui-view&gt;</text>
      <text class="url end" x="292" y="240.5">in &lt;app-root&gt;</text>
      <rect class="box filled" x="24" y="256" width="268" height="52" rx="6" />
      <circle class="glyph disc" cx="42" cy="282" r="5.75" />
      <text class="name strong" x="58" y="286.5">{{ current.name }}</text>
      <text class="url end on-wash" x="276" y="286.5">
        {{ current.more ? `${current.renders} …` : current.renders }}
      </text>
    </svg>

    <figcaption class="visually-hidden">
      <p>
        The Hello World example registers {{ leaves.length }} states under the
        router's root state. Each state's component renders into the one
        <code>&lt;ui-view&gt;</code> in <code>&lt;app-root&gt;</code>, which
        shows the active state.
      </p>
      <ul>
        <li v-for="leaf in leaves" :key="leaf.name">
          State <code>{{ leaf.name }}</code> owns the URL
          <code>{{ leaf.url }}</code> and renders <code>{{ leaf.renders }}</code
          >{{ leaf.more ? ' and more.' : '.' }}
          {{ leaf.name === active ? 'It is the active state.' : '' }}
        </li>
      </ul>
    </figcaption>
  </figure>
</template>

<style scoped>
.state-diagram {
  --diagram-ink: var(--site-color-text);
  --diagram-muted: var(--site-color-text-muted);
  --diagram-ancestor: var(--site-color-diagram-ancestor);
  --diagram-current: var(--site-color-diagram-current);
  --diagram-cool: var(--site-color-identity-ink);
  --diagram-wash: var(--site-color-diagram-wash);
  margin: 0;
}

/* The logo's blue into the current state's orange; the middle turns through violet, as the root does. */
.cool {
  stop-color: var(--diagram-cool);
}

.mid {
  stop-color: color-mix(
    in oklch increasing hue,
    var(--diagram-cool),
    var(--diagram-current)
  );
}

.warm {
  stop-color: var(--diagram-current);
}

.drawing {
  display: block;
  inline-size: 100%;
  max-inline-size: 360px;
  block-size: auto;
  margin-inline: auto;
  overflow: visible;
}

text {
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  fill: var(--diagram-muted);
}

.region,
.edge-label {
  font-family: var(--vp-font-family-base);
  font-size: var(--site-text-caption);
}

.region {
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.name {
  font-size: 13px;
  fill: var(--diagram-ink);
}

.name.quiet {
  fill: var(--diagram-muted);
}

.end {
  text-anchor: end;
}

.box {
  fill: none;
  stroke: var(--diagram-muted);
  stroke-width: 1;
}

.box.ancestor {
  stroke: var(--diagram-ancestor);
}

.glyph {
  fill: none;
  stroke: var(--diagram-muted);
  stroke-width: 1.5;
}

.glyph.on {
  stroke: var(--diagram-ancestor);
}

.glyph.dot {
  fill: var(--diagram-ancestor);
  stroke: none;
}

.glyph.disc {
  fill: var(--diagram-current);
  stroke: none;
}

.edge {
  fill: none;
  stroke: var(--diagram-muted);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}

.arrowhead {
  fill: var(--diagram-muted);
}

/* The current state and the content it fills the view with: weight, wash and a solid mark, so the role reads without colour. */
.current .box,
.box.filled {
  fill: var(--diagram-wash);
  stroke-width: 2;
}

.current .box {
  stroke: var(--diagram-state-stroke);
}

.box.filled {
  stroke: var(--diagram-view-stroke);
}

.current .glyph.ring {
  fill: var(--diagram-current);
  stroke: var(--diagram-current);
}

.current .name,
.name.strong {
  font-weight: 700;
}

.current .url,
.on-wash {
  fill: var(--diagram-ink);
}

.current .edge {
  stroke: var(--diagram-current);
  stroke-width: 2;
  stroke-dasharray: none;
}

.current .arrowhead {
  fill: var(--diagram-current);
}

.current .edge-label {
  fill: var(--diagram-ink);
}

@media (forced-colors: active) {
  .state-diagram {
    --diagram-ink: CanvasText;
    --diagram-muted: CanvasText;
    --diagram-ancestor: Highlight;
    --diagram-current: Highlight;
    --diagram-cool: Highlight;
    --diagram-wash: Canvas;
  }

  /* The stroke urls are set inline, so the boxes take the system colour directly. */
  .current .box,
  .box.filled {
    stroke: Highlight;
  }

  .mid {
    stop-color: Highlight;
  }
}
</style>
