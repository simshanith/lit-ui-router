<script setup lang="ts">
import { computed, useId } from 'vue';
import {
  FEATURES_TOUR_STATES,
  NESTED_VIEW_HOST,
  RESOLVE_TOKEN,
  type FeaturesTourStateName,
} from './features-tour-states';

const props = defineProps<{ active: FeaturesTourStateName }>();

// Top-level states sit in three 96-wide columns, 12 apart, on a 4px grid; the arrow leaves each column at `edge`.
const LAYOUT = [
  { name: 'routing', x: 12, height: 56, edge: 60, label: 68, anchor: 'start' },
  { name: 'nested', x: 120, height: 112, edge: 148, label: 140, anchor: 'end' },
  {
    name: 'resolves',
    x: 228,
    height: 56,
    edge: 276,
    label: 268,
    anchor: 'end',
  },
] as const;

const leaves = LAYOUT.map((layout) => ({
  ...layout,
  url: FEATURES_TOUR_STATES.find(({ name }) => name === layout.name)?.url,
}));

const child = FEATURES_TOUR_STATES.find(({ parent }) => parent)!;

// What the current top-level state's content shows beside its name, where it holds no view.
const DETAIL: Partial<Record<FeaturesTourStateName, readonly string[]>> = {
  routing: ["url: '/routing'", "href: '#/routing'"],
  resolves: [`resolve: '${RESOLVE_TOKEN}'`, 'ready before render'],
};

// One id per instance, so two diagrams on a page keep their own gradients.
const uid = useId();

const strokes = {
  '--diagram-state-stroke': `url(#${uid}-state)`,
  '--diagram-view-stroke': `url(#${uid}-view)`,
};

const top = computed(
  () =>
    FEATURES_TOUR_STATES.find(({ name }) => name === props.active)?.top ??
    'routing',
);

const childActive = computed(() => props.active === child.name);

const role = (name: string) =>
  name === props.active
    ? 'current'
    : props.active.startsWith(`${name}.`)
      ? 'ancestor'
      : 'idle';
</script>

<template>
  <figure class="state-diagram" :data-active="active" :style="strokes">
    <svg
      class="drawing"
      viewBox="-2 -2 340 444"
      width="340"
      height="444"
      aria-hidden="true"
    >
      <defs>
        <!-- Glow into ink toward the arrow, so the solid ink arrow joins both boxes at their ink edge. -->
        <linearGradient :id="`${uid}-state`" x1="0" y1="0" x2="0" y2="1">
          <stop class="glow" offset="0" />
          <stop class="ink" offset="1" />
        </linearGradient>
        <linearGradient :id="`${uid}-view`" x1="0" y1="0" x2="0" y2="1">
          <stop class="ink" offset="0" />
          <stop class="glow" offset="1" />
        </linearGradient>
      </defs>

      <text class="region" x="0" y="10">States</text>
      <rect class="box root" x="0" y="24" width="336" height="168" rx="6" />
      <circle class="glyph ring root" cx="20" cy="44" r="5" />
      <circle class="glyph dot root" cx="20" cy="44" r="2" />
      <text class="name root" x="36" y="48.5">(root)</text>

      <g
        v-for="leaf in leaves"
        :key="leaf.name"
        class="leaf"
        :class="role(leaf.name)"
      >
        <rect
          class="box"
          :x="leaf.x"
          y="64"
          width="96"
          :height="leaf.height"
          rx="6"
        />
        <circle class="glyph ring" :cx="leaf.x + 16" cy="84" r="5" />
        <circle class="glyph dot" :cx="leaf.x + 16" cy="84" r="2" />
        <text class="name" :x="leaf.x + 28" y="88.5">{{ leaf.name }}</text>
        <text class="url" :x="leaf.x + 28" y="107">{{ leaf.url }}</text>
        <path class="edge" :d="`M${leaf.edge} ${64 + leaf.height}V255`" />
        <path class="arrowhead" :d="`M${leaf.edge - 5} 254h10l-5 8z`" />
        <text
          v-if="leaf.name === active"
          class="edge-label"
          :x="leaf.label"
          y="236"
          :text-anchor="leaf.anchor"
        >
          renders now
        </text>
      </g>

      <g class="leaf" :class="role(child.name)">
        <rect class="box" x="128" y="116" width="80" height="48" rx="6" />
        <circle class="glyph ring" cx="142" cy="132" r="5" />
        <text class="name" x="154" y="136.5">.child</text>
        <text class="url" x="154" y="154">{{ child.url }}</text>
        <template v-if="top === child.parent">
          <path class="edge" d="M196 164V335" />
          <path class="arrowhead" d="M191 334h10l-5 8z" />
          <text v-if="childActive" class="edge-label" x="204" y="236">
            renders now
          </text>
        </template>
      </g>

      <text class="region" x="0" y="252">Views</text>
      <rect class="box view" x="0" y="264" width="336" height="176" rx="6" />
      <rect class="glyph view" x="15" y="279" width="10" height="10" rx="2" />
      <text class="name view" x="36" y="288.5">&lt;ui-view&gt;</text>
      <text class="url end" x="312" y="288.5">in &lt;app-root&gt;</text>

      <rect class="box filled" x="12" y="304" width="312" height="124" rx="6" />
      <circle class="glyph disc" cx="30" cy="324" r="5.75" />
      <text class="name strong" x="44" y="328.5">{{ top }}</text>
      <text
        v-for="(line, index) in DETAIL[top]"
        :key="line"
        class="url on-wash"
        x="44"
        :y="352 + index * 20"
      >
        {{ line }}
      </text>

      <template v-if="top === child.parent">
        <rect class="box view" x="24" y="344" width="288" height="72" rx="6" />
        <rect class="glyph view" x="39" y="359" width="10" height="10" rx="2" />
        <text class="name view" x="56" y="363.5">&lt;ui-view&gt;</text>
        <text class="url end on-wash" x="300" y="363.5">
          in &lt;{{ NESTED_VIEW_HOST }}&gt;
        </text>
        <template v-if="childActive">
          <rect
            class="box filled"
            x="36"
            y="376"
            width="264"
            height="28"
            rx="6"
          />
          <circle class="glyph disc" cx="52" cy="390" r="5" />
          <text class="name strong" x="64" y="394.5">{{ child.name }}</text>
        </template>
        <text v-else class="url on-wash" x="40" y="394.5">
          fallback content
        </text>
      </template>
    </svg>

    <figcaption class="visually-hidden">
      <p>
        The features tour registers {{ FEATURES_TOUR_STATES.length }} states
        under the router's root state. A top-level state renders into the
        <code>&lt;ui-view&gt;</code> in <code>&lt;app-root&gt;</code>; the child
        state renders into the <code>&lt;ui-view&gt;</code> inside
        <code>&lt;{{ NESTED_VIEW_HOST }}&gt;</code>, its parent's component.
      </p>
      <ul>
        <li v-for="state in FEATURES_TOUR_STATES" :key="state.name">
          State <code>{{ state.name }}</code> owns the URL
          <code>{{ state.path }}</code>
          {{
            state.parent
              ? `and renders into the view inside its parent, ${state.parent}.`
              : 'and renders into the top-level view.'
          }}
          {{
            role(state.name) === 'current'
              ? 'It is the active state.'
              : role(state.name) === 'ancestor'
                ? 'It is active, as the parent of the active state.'
                : ''
          }}
        </li>
      </ul>
    </figcaption>
  </figure>
</template>

<style scoped>
.state-diagram {
  --diagram-ink: var(--site-color-text);
  --diagram-muted: var(--site-color-text-muted);
  --diagram-current: var(--site-color-identity-ink);
  --diagram-glow: var(--site-color-diagram-glow);
  --diagram-wash: var(--site-color-diagram-wash);
  --diagram-root: var(--site-color-diagram-root);
  --diagram-view: var(--site-color-diagram-view);
  margin: 0;
}

.ink {
  stop-color: var(--diagram-current);
}

.glow {
  stop-color: var(--diagram-glow);
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

/* The outer boxes: the root and the ui-view it fills, in accent colours at 1px, secondary to the current state's 2px. */
.name.root {
  fill: var(--diagram-root);
}

.name.view {
  fill: var(--diagram-view);
}

.end {
  text-anchor: end;
}

.box {
  fill: none;
  stroke: var(--diagram-muted);
  stroke-width: 1;
}

.box.root,
.glyph.root {
  stroke: var(--diagram-root);
}

.box.view,
.glyph.view {
  stroke: var(--diagram-view);
}

.glyph {
  fill: none;
  stroke: var(--diagram-muted);
  stroke-width: 1.5;
}

.glyph.dot {
  fill: var(--diagram-root);
  stroke: none;
}

/* A leaf's dot marks it only as the active parent of the current state. */
.leaf .glyph.dot {
  display: none;
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

/* The current state's parent is active too: 1px ink, a ring with a dot, and its own solid arrow, since it fills the top view. */
.ancestor .box,
.ancestor .glyph.ring {
  stroke: var(--diagram-current);
}

.ancestor .glyph.dot {
  display: inline;
  fill: var(--diagram-current);
}

.ancestor .edge {
  stroke: var(--diagram-current);
  stroke-width: 2;
  stroke-dasharray: none;
}

.ancestor .arrowhead {
  fill: var(--diagram-current);
}

@media (forced-colors: active) {
  .state-diagram {
    --diagram-ink: CanvasText;
    --diagram-muted: CanvasText;
    --diagram-current: Highlight;
    --diagram-glow: Highlight;
    --diagram-wash: Canvas;
    --diagram-root: CanvasText;
    --diagram-view: CanvasText;
  }

  /* The stroke urls are set inline, so the boxes take the system colour directly. */
  .current .box,
  .box.filled {
    stroke: Highlight;
  }
}
</style>
