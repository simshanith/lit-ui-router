<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  useTemplateRef,
  watch,
} from 'vue';
import { withBase } from 'vitepress';
import { VPIcon } from 'vitepress/theme';
import {
  HOME_SAMPLE_LINKS,
  HOME_SAMPLE_REGIONS as regions,
  type SampleRegion,
} from '../../../catalog/home-sample.ts';
import { wiresFor, type Wire } from './annotation-wires.ts';
import { hashForCard } from './features-tour-states';
import { data } from './home-sample.data.ts';

const uid = useId();

const root = useTemplateRef('root');

const picker = useTemplateRef('picker');

const tabs = useTemplateRef<HTMLElement[]>('tabs');

const notes = useTemplateRef<HTMLElement[]>('notes');

const listing = useTemplateRef('listing');

const scroller = useTemplateRef('scroller');

const gutter = useTemplateRef('gutter');

const code = useTemplateRef('code');

/** One explanation at a time under a tab list, where the side rail does not fit; the stylesheet decides, and `update` reads its answer. */
const narrow = ref(false);

/** False in the prerendered page and until this one mounts: a card's toggle is offered only once it can choose. */
const mounted = ref(false);

/** A card's heading holds a toggle beside the code; under the tabs the tab is the control. */
const toggles = computed(() => mounted.value && !narrow.value);

/** The region a click or a tab chose; none until one does. */
const selected = ref<number>();

const hovered = ref<number>();

const focused = ref<number>();

/** The explanation a narrow screen shows. */
const current = computed(() => selected.value ?? 0);

/** The region and explanation drawn as a pair. */
const active = computed(() =>
  narrow.value
    ? current.value
    : (hovered.value ?? focused.value ?? selected.value),
);

// Empty until Previous or Next moves the explanation: a tab announces itself, a stepper button does not.
const announcement = ref('');

const rows = Array.from({ length: data.lines }, (_, index) => {
  const region = regions.findIndex(({ start }) => start[0] === index + 1);

  return { line: index + 1, region: region < 0 ? undefined : region };
});

/** An explanation's text in runs, the backticked ones set as code. */
const runsOf = (text: string) =>
  text.split('`').map((run, index) => ({ text: run, code: index % 2 === 1 }));

const linesOf = ({ start: [first], end: [last] }: SampleRegion) =>
  first === last ? `Line ${first}` : `Lines ${first} to ${last}`;

const canHover = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

function marksOf(index: number): HTMLElement[] {
  return [
    ...(code.value?.querySelectorAll<HTMLElement>(
      `mark[data-region="${regions[index].id}"]`,
    ) ?? []),
  ];
}

/** The region a pointer event lands in: a marked span of the code, or its number in the gutter. */
function regionAt(target: EventTarget | null): number | undefined {
  if (!(target instanceof Element)) return undefined;

  const id = target.closest<HTMLElement>('[data-region]')?.dataset.region;
  const index = regions.findIndex((region) => region.id === id);

  return index < 0 ? undefined : index;
}

/** A tab keeps one region chosen; a card's button, a region and a gutter number choose theirs and let it go again. */
function choose(index: number) {
  selected.value =
    !narrow.value && selected.value === index ? undefined : index;
}

function onCodeOver(event: PointerEvent) {
  if (canHover()) hovered.value = regionAt(event.target);
}

function onCodeClick(event: MouseEvent) {
  const index = regionAt(event.target);

  // A drag that selects code ends in a click too.
  if (index === undefined || !getSelection()?.isCollapsed) return;
  choose(index);
}

function onNoteEnter(index: number) {
  if (canHover()) hovered.value = index;
}

// Keyboard focus only: a button keeps focus after a click that lets its region go.
function onToggleFocus(event: FocusEvent, index: number) {
  if (event.target instanceof Element && event.target.matches(':focus-visible'))
    focused.value = index;
}

/** The tab a key moves to from `from`, wrapping at either end; `undefined` for a key the tab list leaves alone. */
function tabFor(key: string, from: number, last: number): number | undefined {
  switch (key) {
    case 'ArrowRight':
      return from === last ? 0 : from + 1;
    case 'ArrowLeft':
      return from === 0 ? last : from - 1;
    case 'Home':
      return 0;
    case 'End':
      return last;
    default:
      return undefined;
  }
}

// Selection follows focus: showing an explanation costs nothing.
function onTabKey(event: KeyboardEvent) {
  const to = tabFor(event.key, current.value, regions.length - 1);

  if (to === undefined) return;
  event.preventDefault();
  selected.value = to;
  tabs.value?.[to]?.focus();
}

function step(by: number) {
  const to = (current.value + by + regions.length) % regions.length;

  selected.value = to;
  announcement.value = `${regions[to].label}, ${to + 1} of ${regions.length}`;
}

/** Scrolls the code sideways, and only the code, until a region shows: all of it where it fits, its start where it does not. */
function reveal(index: number) {
  const [first] = marksOf(index);

  if (!first || !scroller.value || !gutter.value) return;

  const port = scroller.value.getBoundingClientRect();
  const box = first.getBoundingClientRect();
  // Negative where the gutter covers the region's start; positive where its end runs past the edge.
  const start = box.left - (port.left + gutter.value.offsetWidth + 16);
  const over = box.right + 16 - port.right;

  scroller.value.scrollBy({
    left: start < 0 ? start : Math.min(Math.max(0, over), start),
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth',
  });
}

const wires = ref<Wire[]>([]);

/** Measures each region and its card, in the root's own pixels, for `wiresFor` to join. */
function connect(): Wire[] {
  if (!root.value || !listing.value || !scroller.value || !gutter.value)
    return [];

  const origin = root.value.getBoundingClientRect();
  const port = scroller.value.getBoundingClientRect();
  const clear = port.left + gutter.value.offsetWidth;

  const pairs = regions.flatMap((_, index) => {
    const marks = marksOf(index);
    const card = notes.value?.[index]?.getBoundingClientRect();

    if (marks.length === 0 || !card) return [];

    const boxes = marks.map((mark) => mark.getBoundingClientRect());

    // Past the end of the text on the region's lines, so the connector strikes through none of it.
    const right = Math.max(
      ...marks.map(
        (mark) => (mark.closest('.line') ?? mark).getBoundingClientRect().right,
      ),
    );

    return [
      {
        from: {
          // Held inside the code's frame while the code is scrolled sideways.
          x: Math.min(Math.max(right + 6, clear), port.right) - origin.left,
          y:
            (Math.min(...boxes.map((box) => box.top)) +
              Math.max(...boxes.map((box) => box.bottom))) /
              2 -
            origin.top,
        },
        card: {
          left: card.left - origin.left,
          top: card.top - origin.top,
          bottom: card.bottom - origin.top,
        },
      },
    ];
  });

  return wiresFor(
    pairs,
    listing.value.getBoundingClientRect().right - origin.left,
  );
}

function update() {
  if (!picker.value) return;
  narrow.value = getComputedStyle(picker.value).display !== 'none';
  wires.value = narrow.value ? [] : connect();
}

let frame = 0;

function schedule() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(update);
}

/** The listing is one string of markup, so its regions are marked active by hand. */
function mark() {
  regions.forEach((_, index) => {
    for (const element of marksOf(index))
      element.toggleAttribute('data-active', index === active.value);
  });
}

watch(active, mark);

watch(current, (index) => {
  if (narrow.value) reveal(index);
});

// A region chosen beside the code stays chosen as the layout narrows to the tabs, so the code moves to it then.
watch(narrow, (isNarrow) => {
  if (isNarrow) reveal(current.value);
});

const copied = ref<'done' | 'failed'>();

const copyMessage = ref('');

let copyTimer: ReturnType<typeof setTimeout> | undefined;

let lastCopyMessage = '';

async function copy() {
  let message: string;

  try {
    await navigator.clipboard.writeText(
      code.value?.querySelector('code')?.textContent ?? '',
    );
    copied.value = 'done';
    message = 'Copied';
  } catch {
    copied.value = 'failed';
    message = 'Copy failed';
  }

  // VoiceOver skips a status that repeats the last one; a no-break space makes it new.
  if (message === lastCopyMessage) message += '\u00A0';
  lastCopyMessage = message;
  copyMessage.value = message;
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = undefined;
    copyMessage.value = '';
  }, 2000);
}

let observer: ResizeObserver | undefined;

onMounted(() => {
  // Connectors follow the layout: a resize, a zoom, a font that arrives late, and the code scrolling sideways.
  observer = new ResizeObserver(schedule);

  for (const element of [root.value, listing.value, ...(notes.value ?? [])])
    if (element) observer.observe(element);
  document.fonts.addEventListener('loadingdone', schedule);
  mounted.value = true;
  update();
  mark();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  document.fonts.removeEventListener('loadingdone', schedule);
  cancelAnimationFrame(frame);
  clearTimeout(copyTimer);
});
</script>

<template>
  <section class="home-code" aria-labelledby="home-code-title">
    <div class="container">
      <h2 id="home-code-title" class="title">Read the code</h2>
      <p class="lede">
        A small app of the same shape as the tour that runs below: one state
        with a URL parameter, a resolve and a component, and an element that
        holds its view and a link to it. The listing leaves out its imports and
        the router setup. The
        <a :href="HOME_SAMPLE_LINKS.tourSource" target="_blank" rel="noopener"
          >tour's full source</a
        >
        is on GitHub, and the
        <a :href="withBase(HOME_SAMPLE_LINKS.tutorial)">tutorial</a>
        builds an app step by step.
      </p>

      <div ref="root" class="annotated">
        <!-- Narrow screens: tabs choose the one explanation shown above the code. Hidden where the side rail fits. -->
        <div ref="picker" class="picker">
          <div
            class="tabs"
            role="tablist"
            aria-label="Annotations"
            @keydown="onTabKey"
          >
            <button
              v-for="(region, index) in regions"
              :id="`${uid}-tab-${index}`"
              :key="region.id"
              ref="tabs"
              class="tab"
              type="button"
              role="tab"
              :aria-selected="current === index"
              :tabindex="current === index ? 0 : -1"
              @click="choose(index)"
            >
              <span class="badge">{{ index + 1 }}</span>
              <span class="tab-label">{{ region.label }}</span>
            </button>
          </div>
          <div class="stepper">
            <button
              class="step"
              type="button"
              aria-label="Previous annotation"
              @click="step(-1)"
            >
              <VPIcon icon="lucide:chevron-left" aria-hidden="true" />
            </button>
            <span class="count">{{ current + 1 }} of {{ regions.length }}</span>
            <button
              class="step"
              type="button"
              aria-label="Next annotation"
              @click="step(1)"
            >
              <VPIcon icon="lucide:chevron-right" aria-hidden="true" />
            </button>
          </div>
          <p class="visually-hidden" role="status">{{ announcement }}</p>
        </div>

        <!-- A tab panel each on a narrow screen, a card each beside the code; a panel with no link in it takes focus itself. -->
        <div class="notes">
          <div
            v-for="(region, index) in regions"
            :key="region.id"
            ref="notes"
            class="note"
            :role="narrow ? 'tabpanel' : undefined"
            :aria-labelledby="narrow ? `${uid}-tab-${index}` : undefined"
            :tabindex="
              narrow && current === index && !region.card ? 0 : undefined
            "
            :data-current="current === index ? '' : undefined"
            :data-active="active === index ? '' : undefined"
            @pointerenter="onNoteEnter(index)"
            @pointerleave="hovered = undefined"
          >
            <div class="note-head">
              <h3 class="note-title">
                <component
                  :is="toggles ? 'button' : 'span'"
                  class="note-toggle"
                  v-bind="
                    !toggles
                      ? {}
                      : {
                          type: 'button',
                          'aria-pressed': selected === index,
                          'aria-describedby': `${uid}-lines-${index}`,
                        }
                  "
                  v-on="
                    !toggles
                      ? {}
                      : {
                          click: () => choose(index),
                          focus: (event: FocusEvent) =>
                            onToggleFocus(event, index),
                          blur: () => (focused = undefined),
                        }
                  "
                >
                  <span class="badge">{{ index + 1 }}</span>
                  {{ region.label }}
                </component>
              </h3>
              <p :id="`${uid}-lines-${index}`" class="note-lines">
                {{ linesOf(region) }}
              </p>
            </div>
            <p class="note-text">
              <template v-for="(run, at) in runsOf(region.explanation)">
                <code v-if="run.code" :key="at">{{ run.text }}</code>
                <template v-else>{{ run.text }}</template>
              </template>
            </p>
            <!-- The coupling with See it run, whole: this link and the `card` field it reads. -->
            <a
              v-if="region.card"
              class="note-live"
              :href="hashForCard(region.card)"
              >Open the {{ region.label }} card below</a
            >
          </div>
        </div>

        <div ref="listing" class="listing">
          <div class="bar">
            <span class="lang">TypeScript</span>
            <span class="copy">
              <!-- Outside the button: a live region inside one is not read out. -->
              <span class="tip" role="status">{{ copyMessage }}</span>
              <button class="copy-button" type="button" @click="copy">
                <VPIcon
                  v-show="copied !== 'done'"
                  icon="lucide:copy"
                  aria-hidden="true"
                />
                <VPIcon
                  v-show="copied === 'done'"
                  icon="lucide:check"
                  aria-hidden="true"
                />
                Copy code
              </button>
            </span>
          </div>
          <div
            ref="scroller"
            class="scroller"
            @pointerover="onCodeOver"
            @pointerleave="hovered = undefined"
            @click="onCodeClick"
            @scroll.passive="schedule"
          >
            <!-- Line numbers and region numbers, pinned while the code scrolls sideways; the code beside them is the whole listing, so they are hidden from a screen reader and from a selection. -->
            <div ref="gutter" class="gutter" aria-hidden="true">
              <span v-for="row in rows" :key="row.line" class="row">
                <span
                  v-if="row.region !== undefined"
                  class="badge"
                  :data-region="regions[row.region].id"
                  :data-active="active === row.region ? '' : undefined"
                  >{{ row.region + 1 }}</span
                >
                <span class="number">{{ row.line }}</span>
              </span>
            </div>
            <!-- The site's own highlighter output, built from catalog/home-sample/app.ts. -->
            <div ref="code" class="code" v-html="data.html" />
          </div>
        </div>

        <!-- Drawn once the page has measured itself; the numbers already pair each region with its card. -->
        <svg class="wires" aria-hidden="true">
          <g
            v-for="(wire, index) in wires"
            :key="regions[index].id"
            class="wire"
            :class="{ on: active === index }"
          >
            <path :d="wire.d" />
            <circle :cx="wire.from.x" :cy="wire.from.y" r="2.5" />
            <circle :cx="wire.to.x" :cy="wire.to.y" r="3" />
          </g>
        </svg>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-code {
  padding-inline: 1.5rem;
  margin-block-start: 3rem;
}

@media (min-width: 40rem) {
  .home-code {
    padding-inline: 3rem;
    margin-block-start: 4rem;
  }
}

@media (min-width: 60rem) {
  .home-code {
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

.lede a,
.note-live {
  color: var(--site-color-interaction);
  text-decoration: underline;
  text-underline-offset: 0.125rem;
  transition: color var(--site-duration-base) var(--ease-out);
}

@media (hover: hover) and (pointer: fine) {
  .lede a:hover,
  .note-live:hover {
    color: var(--site-color-interaction-hover);
  }
}

.lede a:focus-visible,
.note-live:focus-visible,
.note-toggle:focus-visible,
.note:focus-visible,
.tab:focus-visible,
.step:focus-visible,
.copy-button:focus-visible {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: var(--site-focus-ring-offset);
  border-radius: var(--site-radius-control-inner);
}

/* The diagram's vocabulary: a neutral outline at rest, the identity ink over a wash for the pair in hand. */
.annotated {
  --annotation-ink: var(--site-color-identity-ink);
  --annotation-rest: var(--site-color-text-muted);
  --annotation-wash: var(--site-color-diagram-wash);
  --annotation-code-wash: var(--site-color-code-wash);
  --annotation-chip-ink: var(--site-color-surface);
  --annotation-line: 1.5px;
  --code-ground: var(--vp-code-block-bg);
  position: relative;
  display: grid;
  gap: var(--site-space-3);
  margin-block-start: var(--site-space-6);
}

/* A region's number: outlined at rest and filled for the pair in hand, so the state reads without colour. */
.badge {
  display: inline-grid;
  flex: none;
  place-items: center;
  inline-size: 20px;
  block-size: 20px;
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-caption);
  font-weight: 700;
  line-height: 1;
  color: var(--annotation-ink);
  border: var(--annotation-line) solid var(--annotation-ink);
  border-radius: var(--site-radius-pill);
}

.note[data-active] .badge,
.gutter .badge[data-active],
.tab[aria-selected='true'] .badge {
  color: var(--annotation-chip-ink);
  background: var(--annotation-ink);
}

.picker {
  display: flex;
  flex-wrap: wrap;
  gap: var(--site-space-2) var(--site-space-3);
  align-items: center;
  justify-content: space-between;
}

/* The first number sits on the section's edge, inside its tab's hit area. */
.tabs {
  display: flex;
  gap: var(--site-space-1);
  margin-inline-start: calc(-1 * var(--site-space-2));
}

.tab {
  position: relative;
  display: inline-flex;
  gap: var(--site-space-1-5);
  align-items: center;
  justify-content: center;
  min-inline-size: 36px;
  min-block-size: 36px;
  padding-inline: var(--site-space-2);
  font-size: var(--site-text-sm);
  font-weight: 500;
  color: var(--site-color-text-muted);
  touch-action: manipulation;
  cursor: pointer;
}

.tab[aria-selected='true'] {
  color: var(--site-color-text);
}

/* A border, not a background: forced colours keep it. */
.tab[aria-selected='true']::after {
  position: absolute;
  inset: auto var(--site-space-2) 0;
  content: '';
  border-block-end: var(--site-focus-ring-width) solid var(--annotation-ink);
}

/* Numbers alone where five labelled tabs do not fit on one row; each label stays in its tab's name. */
@container (inline-size < 44rem) {
  .tab-label {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    white-space: nowrap;
    clip-path: inset(50%);
  }
}

.stepper {
  display: flex;
  gap: var(--site-space-1);
  align-items: center;
}

.count {
  min-inline-size: 6ch;
  font-size: var(--site-text-xs);
  font-variant-numeric: tabular-nums;
  color: var(--site-color-text-muted);
  text-align: center;
}

.step {
  display: inline-grid;
  place-items: center;
  inline-size: 36px;
  block-size: 36px;
  font-size: var(--site-icon-sm);
  color: var(--site-color-text);
  touch-action: manipulation;
  cursor: pointer;
  background: var(--site-color-surface);
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-control);
}

.note {
  min-inline-size: 0;
  padding: var(--site-space-3) var(--site-space-4);
  background: var(--site-color-surface-soft);
  border: var(--annotation-line) solid var(--site-color-line);
  border-radius: var(--site-radius-card);
}

.note[data-active] {
  border-color: var(--annotation-ink);
}

.note-head {
  display: flex;
  gap: var(--site-space-3);
  align-items: center;
  justify-content: space-between;
}

.note-title {
  margin: 0;
  font-size: var(--site-text-sm);
  font-weight: 600;
  line-height: 1.5;
  color: var(--site-color-text);
}

.note-toggle {
  display: inline-flex;
  gap: var(--site-space-2);
  align-items: center;
  min-block-size: var(--site-icon-md);
  font: inherit;
  color: inherit;
  text-align: start;
}

button.note-toggle {
  touch-action: manipulation;
  cursor: pointer;
}

.note-lines {
  margin: 0;
  font-size: var(--site-text-xs);
  line-height: 1.5;
  color: var(--site-color-text-muted);
  white-space: nowrap;
}

/* Under the label, clear of the number. */
.note-text,
.note-live {
  margin-inline-start: calc(20px + var(--site-space-2));
}

.note-text {
  margin-block: var(--site-space-1) 0;
  font-size: var(--site-text-sm);
  line-height: 1.6;
  color: var(--site-color-text-muted);
  text-wrap: pretty;
}

.note-text code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.875em;
  color: var(--site-color-text);
}

.note-live {
  display: inline-block;
  margin-block-start: var(--site-space-1-5);
  font-size: var(--site-text-sm);
  font-weight: 500;
  line-height: 1.6;
}

.listing {
  min-inline-size: 0;
  overflow: clip;
  background: var(--code-ground);
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-card);
}

/* Full-bleed on a phone, out to the section's own padding, as the tour's panels are. */
@media (width < 40rem) {
  .listing {
    margin-inline: -1.5rem;
    border-inline: 0;
    border-radius: 0;
  }
}

.bar {
  display: flex;
  gap: var(--site-space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--site-space-1-5) var(--site-space-2) var(--site-space-1-5)
    var(--site-space-4);
  border-block-end: var(--site-border-width) solid var(--site-color-line);
}

.lang,
.tip {
  font-size: var(--site-text-xs);
  font-weight: 500;
  color: var(--site-color-text-muted);
}

.copy {
  display: flex;
  gap: var(--site-space-2);
  align-items: center;
}

.copy-button {
  display: inline-flex;
  gap: var(--site-space-1-5);
  align-items: center;
  min-block-size: 32px;
  padding-inline: var(--site-space-2) var(--site-space-3);
  font-size: var(--site-text-xs);
  font-weight: 500;
  color: var(--site-color-text);
  touch-action: manipulation;
  cursor: pointer;
  background: var(--site-color-surface);
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: var(--site-radius-control);
}

.copy-button .vpi-lucide-copy,
.copy-button .vpi-lucide-check {
  font-size: 14px;
}

.copy-button:active,
.step:active {
  transform: scale(0.97);
}

@media (hover: hover) and (pointer: fine) {
  .copy-button:hover,
  .step:hover {
    border-color: var(--site-color-interaction);
  }

  .tab:hover {
    color: var(--site-color-text);
  }
}

/* One line height for the gutter's rows and the code's lines, so each number sits on its line at any zoom. */
.scroller {
  display: flex;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: var(--vp-code-line-height);
}

.gutter {
  position: sticky;
  inset-inline-start: 0;
  z-index: 1;
  flex: none;
  padding: var(--site-space-4) var(--site-space-2);
  color: var(--site-color-text-muted);
  user-select: none;
  background: var(--code-ground);
  border-inline-end: var(--site-border-width) solid var(--site-color-line);
}

.row {
  display: grid;
  grid-template-columns: 20px 2ch;
  column-gap: var(--site-space-1-5);
  align-items: center;
  block-size: 1lh;
}

.row .badge {
  cursor: pointer;
}

.number {
  grid-column: 2;
  text-align: end;
}

.code {
  flex: 1 0 auto;
  min-inline-size: max-content;
}

.code :deep(pre) {
  padding: var(--site-space-4) var(--site-space-5) var(--site-space-4)
    var(--site-space-4);
  margin: 0;
  font: inherit;
}

.code :deep(pre:focus-visible) {
  outline: var(--site-focus-ring-width) solid var(--site-color-interaction);
  outline-offset: calc(-1 * var(--site-focus-ring-width));
}

.code :deep(code) {
  display: block;
  font: inherit;
  color: var(--vp-code-block-color);
  white-space: pre;
}

/* A region part: an inline box a region's width in characters, drawn over its own padding so the text beside it does not move. The parts of a region of several lines stack into one rectangle. */
.code :deep(mark) {
  --region-pad: 2.5px;
  box-sizing: content-box;
  display: inline-block;
  min-inline-size: calc(var(--span) * 1ch);
  padding-inline: calc(var(--region-pad) - var(--annotation-line));
  margin-inline: calc(-1 * var(--region-pad));
  color: inherit;
  cursor: pointer;
  background: none;
  border: 0 dashed var(--annotation-rest);
  border-inline-width: var(--annotation-line);
}

.code :deep(mark[data-part='only']) {
  margin-block: calc(-1 * var(--annotation-line));
  line-height: 1.45;
  border-block-width: var(--annotation-line);
  border-radius: var(--site-radius-control-inner);
}

.code :deep(mark[data-part='start']) {
  margin-block-start: calc(-1 * var(--annotation-line));
  border-block-start-width: var(--annotation-line);
  border-start-start-radius: var(--site-radius-control-inner);
  border-start-end-radius: var(--site-radius-control-inner);
}

.code :deep(mark[data-part='end']) {
  margin-block-end: calc(-1 * var(--annotation-line));
  border-block-end-width: var(--annotation-line);
  border-end-start-radius: var(--site-radius-control-inner);
  border-end-end-radius: var(--site-radius-control-inner);
}

.code :deep(mark[data-active]) {
  background: var(--annotation-code-wash);
  border-color: var(--annotation-ink);
  border-style: solid;
}

.wires {
  position: absolute;
  inset: 0;
  display: none;
  inline-size: 100%;
  block-size: 100%;
  overflow: visible;
  pointer-events: none;
}

.wire path {
  fill: none;
  stroke: var(--annotation-rest);
  stroke-dasharray: 3 3;
  stroke-width: var(--annotation-line);
}

.wire circle {
  fill: var(--site-color-surface);
  stroke: var(--annotation-rest);
  stroke-width: var(--annotation-line);
}

.wire.on path {
  stroke: var(--annotation-ink);
  stroke-dasharray: none;
  stroke-width: 2;
}

.wire.on circle {
  fill: var(--annotation-ink);
  stroke: var(--annotation-ink);
}

/* One explanation above the code: every panel shares a cell, so the cell is as tall as the tallest and the code below holds still. */
@container (inline-size < 60rem) {
  .notes {
    display: grid;
  }

  .note,
  .note[data-active] {
    grid-area: 1 / 1;
    background: var(--annotation-wash);
    border-color: transparent;
    border-inline-start: 3px solid var(--annotation-ink);
    border-start-start-radius: 0;
    border-end-start-radius: 0;
  }

  .note:not([data-current]) {
    visibility: hidden;
  }

  /* Without scripting the tabs cannot choose, so every explanation shows, in order. */
  @media (scripting: none) {
    .picker {
      display: none;
    }

    .notes {
      gap: var(--site-space-2);
    }

    .note {
      grid-area: auto;
    }

    .note:not([data-current]) {
      visibility: visible;
    }
  }
}

/* The side rail: the code takes its own width, the cards the rest, and the connectors cross the gap. */
@container (inline-size >= 60rem) {
  .annotated {
    grid-template-columns: minmax(0, max-content) minmax(0, 1fr);
    column-gap: 3.5rem;
    align-items: start;
  }

  .picker {
    display: none;
  }

  .listing {
    grid-area: 1 / 1;
  }

  .notes {
    display: flex;
    flex-direction: column;
    grid-area: 1 / 2;
    gap: var(--site-space-3);
  }

  .wires {
    display: block;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .badge,
  .note,
  .code :deep(mark),
  .wire path,
  .wire circle {
    transition:
      color var(--site-duration-fast) var(--ease-out),
      background-color var(--site-duration-fast) var(--ease-out),
      border-color var(--site-duration-fast) var(--ease-out),
      fill var(--site-duration-fast) var(--ease-out),
      stroke var(--site-duration-fast) var(--ease-out);
  }

  .copy-button,
  .step {
    transition:
      border-color var(--site-duration-fast) var(--ease-out),
      transform var(--site-duration-fast) var(--ease-out);
  }

  .tip {
    transition: opacity var(--site-duration-fast) var(--ease-out);
  }
}

/* Shown by opacity: a status taken out of the tree is not announced. */
.tip:empty {
  opacity: 0;
}

@media (forced-colors: active) {
  .annotated {
    --annotation-ink: Highlight;
    --annotation-rest: CanvasText;
    --annotation-wash: Canvas;
    --annotation-code-wash: transparent;
    --annotation-chip-ink: HighlightText;
    --code-ground: Canvas;
  }

  .note,
  .listing {
    border-color: CanvasText;
  }

  .note[data-active] {
    border-color: Highlight;
  }
}
</style>
