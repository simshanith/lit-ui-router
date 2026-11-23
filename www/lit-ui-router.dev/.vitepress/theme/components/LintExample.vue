<script setup lang="ts">
defineProps<{
  rule: string;
  label: string;
  fixable?: boolean;
}>();
</script>

<template>
  <figure class="lint-example" :aria-label="label">
    <div class="plate plate-incorrect">
      <div class="plate-head">
        <span class="verdict verdict-incorrect">
          <svg
            class="verdict-icon"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2 2L10 10M10 2L2 10"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="square"
            />
          </svg>
          Incorrect
        </span>
        <code class="plate-rule">{{ rule }}</code>
      </div>

      <div class="plate-stage">
        <div class="plate-code">
          <svg
            class="cross-hatch"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <line
              x1="0"
              y1="0"
              x2="100"
              y2="100"
              vector-effect="non-scaling-stroke"
            />
            <line
              x1="100"
              y1="0"
              x2="0"
              y2="100"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          <div class="plate-code-inner">
            <slot name="incorrect" />
          </div>
        </div>
        <div class="plate-stamp" aria-hidden="true">
          <svg
            class="stamp-mark stamp-mark-incorrect"
            viewBox="0 0 36 36"
            focusable="false"
          >
            <path
              d="M7 7L29 29M29 7L7 29"
              fill="none"
              stroke="currentColor"
              stroke-width="4.5"
              stroke-linecap="square"
            />
          </svg>
        </div>
      </div>

      <div v-if="$slots.diagnostic" class="plate-diagnostic">
        <span class="diagnostic-tag">Lint error</span>
        <div class="diagnostic-body">
          <slot name="diagnostic" />
        </div>
      </div>
    </div>

    <div class="plate plate-correct">
      <div class="plate-head">
        <span class="verdict verdict-correct">
          <svg
            class="verdict-icon"
            viewBox="0 0 12 12"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M2 6.4L4.7 9.1L10 3.2"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="square"
            />
          </svg>
          Correct
        </span>
        <span v-if="fixable" class="plate-note">autofixable with --fix</span>
      </div>

      <div class="plate-stage">
        <div class="plate-code">
          <div class="plate-code-inner">
            <slot name="correct" />
          </div>
        </div>
        <div class="plate-stamp" aria-hidden="true">
          <svg
            class="stamp-mark stamp-mark-correct"
            viewBox="0 0 36 36"
            focusable="false"
          >
            <path
              d="M7 18.8L14.5 26.3L29.5 10.5"
              fill="none"
              stroke="currentColor"
              stroke-width="4.5"
              stroke-linecap="square"
            />
          </svg>
        </div>
      </div>
    </div>
  </figure>
</template>

<style scoped>
.lint-example {
  display: flex;
  flex-direction: column;
  gap: var(--site-space-3);
  margin-block: var(--site-space-4) var(--site-space-5);
  margin-inline: 0;
}

.plate {
  border: var(--site-border-width) solid var(--site-color-line);
  border-radius: 0;
  background: var(--site-color-surface);
  overflow: clip;
}

.plate-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--site-space-2);
  padding-block: var(--site-space-2);
  padding-inline: var(--site-space-3);
  border-block-end: var(--site-border-width) solid var(--site-color-line);
  background: var(--site-color-surface-soft);
}

.verdict {
  display: inline-flex;
  align-items: center;
  gap: var(--site-space-1-5);
  padding-block: var(--site-space-0-5);
  padding-inline: var(--site-space-2);
  border-radius: 0;
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-caption);
  font-weight: 700;
  letter-spacing: 0.08em;
  line-height: 1.4;
  text-transform: uppercase;
}

.verdict-incorrect {
  background: var(--status-not-found);
  color: var(--status-not-found-ink);
}

.verdict-correct {
  background: var(--status-ok);
  color: var(--status-ok-ink);
}

.verdict-icon {
  width: 10px;
  height: 10px;
  flex: none;
}

.plate-rule,
.plate-note {
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-xs);
  color: var(--site-color-text-muted);
}

.plate-rule {
  padding: 0;
  background: none;
}

.plate-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 72px;
  background: var(--vp-code-block-bg);
}

.plate-incorrect .plate-stage {
  background: color-mix(
    in srgb,
    var(--status-not-found) 4%,
    var(--vp-code-block-bg)
  );
}

.plate-correct .plate-stage {
  background: color-mix(in srgb, var(--status-ok) 4%, var(--vp-code-block-bg));
}

.plate-code {
  position: relative;
  min-width: 0;
  overflow: clip;
}

/* Faint corner-to-corner cross echoing NASA NHB 1430.2 Section 1.5 without reducing code contrast. */
.cross-hatch {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  stroke: var(--status-not-found);
  stroke-width: 1.5;
  opacity: 0.18;
}

.plate-code-inner {
  position: relative;
  z-index: 1;
}

.plate-code-inner :deep(div[class*='language-']) {
  margin: 0;
  border-radius: 0;
  background: transparent;
}

.plate-code-inner :deep(span.lang) {
  display: none;
}

/* Hide the copy action on antipatterns so readers do not copy broken snippets. */
.plate-incorrect .plate-code-inner :deep(button.copy) {
  display: none;
}

.plate-stamp {
  display: flex;
  align-items: center;
  justify-content: center;
  border-inline-start: var(--site-border-width) solid var(--site-color-line);
  background: var(--site-color-surface-soft);
}

.stamp-mark {
  width: 32px;
  height: 32px;
}

.stamp-mark-incorrect {
  color: var(--status-not-found);
}

.stamp-mark-correct {
  color: var(--status-ok);
}

.plate-diagnostic {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: baseline;
  gap: var(--site-space-2) var(--site-space-3);
  padding-block: var(--site-space-2);
  padding-inline: var(--site-space-3);
  border-block-start: var(--site-border-width) solid var(--site-color-line);
  background: var(--site-color-surface-soft);
}

.diagnostic-tag {
  font-family: var(--vp-font-family-mono);
  font-size: var(--site-text-caption);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--status-not-found);
  white-space: nowrap;
}

.diagnostic-body {
  min-width: 0;
}

.diagnostic-body :deep(div[class*='language-']) {
  margin: 0;
  border-radius: 0;
  background: transparent;
}

.diagnostic-body :deep(span.lang),
.diagnostic-body :deep(button.copy) {
  display: none;
}

.diagnostic-body :deep(pre) {
  margin: 0;
  padding: 0;
  overflow-x: visible;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.diagnostic-body :deep(code) {
  padding: 0;
  font-size: var(--site-text-xs);
  line-height: 1.5;
  color: var(--site-color-text);
  white-space: inherit;
}

@media (max-width: 520px) {
  .plate-stage {
    grid-template-columns: minmax(0, 1fr);
  }

  .plate-stamp {
    display: none;
  }

  .plate-diagnostic {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--site-space-1);
  }
}
</style>
