<script setup lang="ts">
import { computed } from 'vue';
import { CARD_IDS, CARD_STATE, type CardId } from './features-tour-states';

const props = defineProps<{
  card: CardId;
  /** The card the last transition left, or none before the first. */
  from?: CardId;
  /** Counts transitions, so the re-entry mark replays on each. */
  entries: number;
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

const reentered = computed(() => props.from !== undefined);
</script>

<template>
  <figure class="state-diagram" :data-card="card">
    <svg
      class="drawing"
      viewBox="-2 -2 340 306"
      width="340"
      height="306"
      aria-hidden="true"
    >
      <text class="region" x="0" y="10">States</text>
      <rect class="box" x="0" y="24" width="336" height="152" rx="6" />
      <circle class="glyph ring on" cx="20" cy="44" r="5" />
      <circle class="glyph dot" cx="20" cy="44" r="2" />
      <text class="name quiet" x="36" y="48.5">(root)</text>

      <rect class="box current" x="12" y="64" width="312" height="96" rx="6" />
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

      <path class="edge" d="M60 160V199" />
      <path class="arrowhead" d="M55 198h10l-5 8z" />

      <text class="region" x="0" y="196">Views</text>
      <rect class="box" x="0" y="208" width="336" height="92" rx="6" />
      <rect class="glyph" x="15" y="223" width="10" height="10" rx="2" />
      <text class="name" x="36" y="232.5">&lt;ui-view&gt;</text>
      <text class="url end" x="312" y="232.5">in &lt;app-root&gt;</text>
      <rect class="box current" x="12" y="248" width="312" height="40" rx="6" />
      <circle class="glyph disc" cx="30" cy="268" r="5.75" />
      <text class="name strong" x="44" y="272.5">{{ CARD_STATE.name }}</text>
      <text class="url end on-wash" x="312" y="272.5">
        { {{ CARD_STATE.param }}: '{{ card }}' }
      </text>

      <!-- Only after a transition, and keyed by its count, so the flash marks each re-entry and not the first render. -->
      <g v-if="reentered" :key="entries" class="flash">
        <rect x="12" y="64" width="312" height="96" rx="6" />
        <rect x="12" y="248" width="312" height="40" rx="6" />
      </g>
    </svg>

    <!-- The transition log closes the tile, as a devtools log line would. -->
    <p class="log">
      <span>{{
        reentered ? 'exited and re-entered card' : 'entered card'
      }}</span>
      <code>{{
        reentered
          ? `${CARD_STATE.param}: '${from}' → '${card}'`
          : `${CARD_STATE.param}: '${card}'`
      }}</code>
    </p>

    <figcaption class="visually-hidden">
      <p>
        The features tour registers one state,
        <code>{{ CARD_STATE.name }}</code>, under the router's root state, at
        the URL <code>{{ CARD_STATE.url }}</code>. It renders into the
        <code>&lt;ui-view&gt;</code> in <code>&lt;app-root&gt;</code>. Each card
        is a value of its <code>{{ CARD_STATE.param }}</code> parameter:
        {{ CARD_IDS.join(', ') }}.
      </p>
      <p>The active value is <code>{{ card }}</code>.</p>
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
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--site-space-6);
  margin: 0;
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

.region {
  font-family: var(--vp-font-family-base);
  font-size: var(--site-text-caption);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* The log line sits at the foot of the figure, however tall the tile runs. */
.log {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-1) var(--site-space-2);
  align-items: baseline;
  margin: auto 0 0;
  padding-block-start: var(--site-space-4);
  border-block-start: var(--site-border-width) solid var(--site-color-line);
  font-size: var(--site-text-xs);
  line-height: 1.5;
  color: var(--site-color-text-muted);
}

.log code {
  font-family: var(--vp-font-family-mono);
  color: var(--site-color-text);
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

/* Plain outlines: neutral for the root and the view, solid ink over a wash for the current state and its content. */
.box {
  fill: none;
  stroke: var(--diagram-muted);
  stroke-width: 1.5;
}

.box.current {
  fill: var(--diagram-wash);
  stroke: var(--diagram-current);
  stroke-width: 2;
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
    stroke: var(--diagram-current);
    stroke-width: 2;
    animation: flash calc(2 * var(--site-duration-slow)) var(--ease-out)
      forwards;
  }
}

@keyframes flash {
  from {
    stroke-width: 8;
    opacity: 0.6;
  }

  to {
    stroke-width: 2;
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

  .flash {
    display: none;
  }
}
</style>
