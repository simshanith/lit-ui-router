<script setup lang="ts">
import { computed, useId } from 'vue';
import { withBase } from 'vitepress';
import { CARD_IDS, CARD_STATE, type CardId } from './features-tour-states';

/** Where the panel's burst sits, in this drawing's user units. */
export interface Backdrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const props = defineProps<{
  card: CardId;
  /** The card the last transition left, or none before the first. */
  from?: CardId;
  /** Counts transitions, so the re-entry mark replays on each. */
  entries: number;
  backdrop: Backdrop;
}>();

// Chips sit on a 4px grid, 8 apart, sized to their mono labels.
const CHIP_WIDTH: Record<CardId, number> = {
  states: 60,
  views: 52,
  resolves: 72,
};

const chips = CARD_IDS.map((id, index) => ({
  id,
  width: CHIP_WIDTH[id],
  x:
    100 +
    CARD_IDS.slice(0, index).reduce(
      (sum, before) => sum + CHIP_WIDTH[before] + 8,
      0,
    ),
}));

// One id per instance, so two diagrams on a page keep their own patterns.
const uid = useId();

const burst = { '--diagram-burst': `url(#${uid}-burst)` };

const images = {
  light: withBase('/images/see-it-run-burst.svg'),
  dark: withBase('/images/see-it-run-burst-dark.svg'),
};

const reentered = computed(() => props.from !== undefined);
</script>

<template>
  <figure class="state-diagram" :data-card="card" :style="burst">
    <svg
      class="drawing"
      viewBox="-2 -2 340 362"
      width="340"
      height="362"
      aria-hidden="true"
    >
      <defs>
        <!-- One image of the panel's burst, placed at the panel's coordinates, so every stroke samples the same backdrop. -->
        <pattern
          :id="`${uid}-burst`"
          patternUnits="userSpaceOnUse"
          :x="backdrop.x"
          :y="backdrop.y"
          :width="backdrop.width"
          :height="backdrop.height"
        >
          <image
            v-for="(href, theme) in images"
            :key="theme"
            :class="['burst', theme]"
            :href="href"
            :width="backdrop.width"
            :height="backdrop.height"
            preserveAspectRatio="none"
          />
        </pattern>
      </defs>

      <text class="region" x="0" y="10">States</text>
      <rect class="box window" x="0" y="24" width="336" height="152" rx="6" />
      <circle class="glyph ring on" cx="20" cy="44" r="5" />
      <circle class="glyph dot" cx="20" cy="44" r="2" />
      <text class="name quiet" x="36" y="48.5">(root)</text>

      <rect
        class="box window current"
        x="12"
        y="64"
        width="312"
        height="96"
        rx="6"
      />
      <circle class="glyph disc" cx="30" cy="84" r="5.75" />
      <text class="name strong" x="44" y="88.5">{{ CARD_STATE.name }}</text>
      <text class="url end on-wash" x="312" y="88.5">{{ CARD_STATE.url }}</text>
      <text class="url on-wash" x="44" y="129">{{ CARD_STATE.param }}</text>
      <g
        v-for="chip in chips"
        :key="chip.id"
        class="chip"
        :class="{ on: chip.id === card }"
      >
        <rect :x="chip.x" y="113" :width="chip.width" height="22" rx="11" />
        <text :x="chip.x + chip.width / 2" y="128.5">{{ chip.id }}</text>
      </g>

      <path class="edge" d="M60 160V255" />
      <path class="arrowhead" d="M55 254h10l-5 8z" />
      <text class="log" x="72" y="204">
        {{ reentered ? 'exited and re-entered card' : 'entered card' }}
      </text>
      <text class="log url" x="72" y="224">
        {{
          reentered
            ? `${CARD_STATE.param}: '${from}' → '${card}'`
            : `${CARD_STATE.param}: '${card}'`
        }}
      </text>

      <text class="region" x="0" y="252">Views</text>
      <rect class="box window" x="0" y="264" width="336" height="92" rx="6" />
      <rect class="glyph" x="15" y="279" width="10" height="10" rx="2" />
      <text class="name" x="36" y="288.5">&lt;ui-view&gt;</text>
      <text class="url end" x="312" y="288.5">in &lt;app-root&gt;</text>
      <rect
        class="box window current"
        x="12"
        y="304"
        width="312"
        height="40"
        rx="6"
      />
      <circle class="glyph disc" cx="30" cy="324" r="5.75" />
      <text class="name strong" x="44" y="328.5">{{ CARD_STATE.name }}</text>
      <text class="url end on-wash" x="312" y="328.5">
        { {{ CARD_STATE.param }}: '{{ card }}' }
      </text>

      <!-- Keyed by the transition count, so the flash replays on each re-entry. -->
      <g :key="entries" class="flash">
        <rect x="12" y="64" width="312" height="96" rx="6" />
        <rect x="12" y="304" width="312" height="40" rx="6" />
      </g>
    </svg>

    <figcaption class="visually-hidden">
      <p>
        The features tour registers one state,
        <code>{{ CARD_STATE.name }}</code>, under the router's root state, at
        the URL <code>{{ CARD_STATE.url }}</code>. It renders into the
        <code>&lt;ui-view&gt;</code> in <code>&lt;app-root&gt;</code>. Each card
        is a value of its <code>{{ CARD_STATE.param }}</code> parameter:
        {{ CARD_IDS.join(', ') }}.
      </p>
      <p>
        The active value is <code>{{ card }}</code>.
        {{
          reentered
            ? `The last transition exited and re-entered the state, from ${from}.`
            : ''
        }}
      </p>
    </figcaption>
  </figure>
</template>

<style scoped>
.state-diagram {
  --diagram-ink: var(--site-color-text);
  --diagram-muted: var(--site-color-text-muted);
  --diagram-current: var(--site-color-identity-ink);
  --diagram-wash: var(--site-color-diagram-wash);
  --diagram-chip-ink: var(--site-color-surface);
  margin: 0;
}

.burst.dark {
  display: none;
}

:root.dark .burst.light {
  display: none;
}

:root.dark .burst.dark {
  display: inline;
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
.log:not(.url) {
  font-family: var(--vp-font-family-base);
  font-size: var(--site-text-caption);
}

.region {
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.log {
  fill: var(--diagram-ink);
}

.name {
  font-size: 13px;
  fill: var(--diagram-ink);
}

.name.quiet {
  fill: var(--diagram-muted);
}

.name.strong {
  font-weight: 700;
}

.end {
  text-anchor: end;
}

.on-wash {
  fill: var(--diagram-ink);
}

/* Every box's stroke is a window onto the panel's burst; the current ones open wider over a wash. */
.box {
  fill: none;
  stroke-width: 1.5;
}

.window {
  stroke: var(--diagram-burst);
}

.box.current {
  fill: var(--diagram-wash);
  stroke-width: 3;
}

.glyph {
  fill: none;
  stroke: var(--diagram-muted);
  stroke-width: 1.5;
}

.glyph.on {
  stroke: var(--diagram-current);
}

.glyph.dot,
.glyph.disc {
  fill: var(--diagram-current);
  stroke: none;
}

.chip rect {
  fill: none;
  stroke: var(--diagram-muted);
  stroke-width: 1;
}

.chip text {
  text-anchor: middle;
}

/* The current value: a filled chip in bold, so it reads without colour. */
.chip.on rect {
  fill: var(--diagram-current);
  stroke: var(--diagram-current);
}

.chip.on text {
  font-weight: 700;
  fill: var(--diagram-chip-ink);
}

.edge {
  fill: none;
  stroke: var(--diagram-current);
  stroke-width: 2;
}

.arrowhead {
  fill: var(--diagram-current);
}

.flash {
  display: none;
}

@media (prefers-reduced-motion: no-preference) {
  .flash {
    display: inline;
  }

  .flash rect {
    fill: none;
    stroke: var(--diagram-burst);
    stroke-width: 3;
    animation: flash calc(2 * var(--site-duration-slow)) var(--ease-out)
      forwards;
  }
}

@keyframes flash {
  from {
    stroke-width: 9;
    opacity: 1;
  }

  to {
    stroke-width: 3;
    opacity: 0;
  }
}

@media (forced-colors: active) {
  .state-diagram {
    --diagram-ink: CanvasText;
    --diagram-muted: CanvasText;
    --diagram-current: Highlight;
    --diagram-wash: Canvas;
    --diagram-chip-ink: HighlightText;
  }

  /* The burst url is set inline, so the windows take the system colours directly. */
  .window {
    stroke: CanvasText;
  }

  .box.current {
    stroke: Highlight;
  }

  .flash {
    display: none;
  }
}
</style>
